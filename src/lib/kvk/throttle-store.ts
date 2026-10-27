import { createHash } from "node:crypto";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { DAY } from "@/lib/time";
import { type KvkArea, kvkSessionSecret } from "./access";
import { addressScopePrefix, ADDRESS_POLICY, chargeTry, laterStamp, type LockoutPolicy, type ThrottleState } from "./throttle";

/**
 * Storage for the unlock throttle (table kvk_unlock_throttle; server only).
 * Without a database (local design work on the seed plan) nothing is counted.
 *
 * Writes are a compare-and-swap on `updated_at`: read the row, compute the next
 * state, write it only if nobody else wrote in between, else read again. A
 * burst of parallel requests therefore counts every request, where a plain
 * read-then-upsert would count the whole burst once.
 */

const log = createLogger("kvk");

/** The visitor's address as Vercel reports it, hashed with the server secret so no address is stored in clear. */
export function addressHash(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`${kvkSessionSecret()}\u0000${address}`).digest("hex").slice(0, 32);
}

interface Row {
  scope: string;
  failures: number;
  window_started_at: string;
  locked_until: string | null;
  lockouts: number;
  alerted_at: string | null;
  updated_at: string;
}

const COLUMNS = "scope, failures, window_started_at, locked_until, lockouts, alerted_at, updated_at";

/** Compare-and-swap rounds before giving up; only a flood from one address gets that far. */
const MAX_ROUNDS = 6;
/** What a request that lost every round is told: try again in a moment. */
const BUSY_RETRY_MS = 5_000;

function toState(row: Row): ThrottleState {
  return {
    failures: Number(row.failures) || 0,
    windowStartedAt: Date.parse(row.window_started_at) || 0,
    lockedUntil: row.locked_until ? Date.parse(row.locked_until) || null : null,
    lockouts: Number(row.lockouts) || 0,
    alertedAt: row.alerted_at ? Date.parse(row.alerted_at) || null : null,
  };
}

function toRow(scope: string, state: ThrottleState, updatedAt: string): Row {
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
  return {
    scope,
    failures: state.failures,
    window_started_at: new Date(state.windowStartedAt).toISOString(),
    locked_until: iso(state.lockedUntil),
    lockouts: state.lockouts,
    alerted_at: iso(state.alertedAt),
    updated_at: updatedAt,
  };
}

/** States for the given scopes, in the same order; null for unknown scopes or when the table is unreachable. */
export async function loadThrottle(scopes: string[]): Promise<(ThrottleState | null)[]> {
  if (!isSupabaseAdminConfigured()) return scopes.map(() => null);
  const { data, error } = await createAdminClient().from("kvk_unlock_throttle").select(COLUMNS).in("scope", scopes);
  if (error) {
    log.error("Could not read the unlock throttle", { error: error.message });
    return scopes.map(() => null);
  }
  const byScope = new Map((data as Row[]).map((row) => [row.scope, toState(row)]));
  return scopes.map((scope) => byScope.get(scope) ?? null);
}

export type ThrottleUpdate =
  /** `after` is null when `step` chose not to write. */
  | { status: "ok"; before: ThrottleState | null; after: ThrottleState | null }
  /** Every round lost against other writers of the same scope. */
  | { status: "busy" }
  /** No database, or it failed: nothing was counted. */
  | { status: "off" };

/**
 * Applies `step` to the scope's current state as one atomic write. `step` may
 * run more than once (it is re-run on the fresh state after losing a round), so
 * it must only compute; return null to leave the row as it is.
 */
export async function updateThrottle(scope: string, step: (state: ThrottleState | null) => ThrottleState | null): Promise<ThrottleUpdate> {
  if (!isSupabaseAdminConfigured()) return { status: "off" };
  const admin = createAdminClient();
  const table = () => admin.from("kvk_unlock_throttle");

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data: row, error: readError } = await table().select(COLUMNS).eq("scope", scope).maybeSingle<Row>();
    if (readError) {
      log.error("Could not read the unlock throttle", { error: readError.message });
      return { status: "off" };
    }
    const before = row ? toState(row) : null;
    const after = step(before);
    if (!after) return { status: "ok", before, after: null };

    const next = toRow(scope, after, laterStamp(row?.updated_at, Date.now()));
    const write = row
      ? table().update(next).eq("scope", scope).eq("updated_at", row.updated_at).select("scope")
      : table().upsert(next, { onConflict: "scope", ignoreDuplicates: true }).select("scope");
    const { data: written, error: writeError } = await write;
    if (writeError) {
      log.error("Could not save the unlock throttle", { error: writeError.message });
      return { status: "off" };
    }
    if (written && written.length > 0) {
      await maybePrune();
      return { status: "ok", before, after };
    }
    // Another request wrote this scope since we read it: read again and recount.
  }
  log.warn("Unlock throttle busy: too many simultaneous writes for one scope");
  return { status: "busy" };
}

export type TryResult = { allowed: true; state: ThrottleState | null } | { allowed: false; retryAt: number };

/**
 * Counts one try against `scope` before the caller checks anything (see
 * `chargeTry`). Refused while the scope is locked; the returned state already
 * holds this try as a wrong one, so the caller clears the scope on success.
 * Without a database every try is allowed and nothing is counted.
 */
export async function takeTry(scope: string, now: number, policy: LockoutPolicy = ADDRESS_POLICY): Promise<TryResult> {
  let retryAt = 0;
  const result = await updateThrottle(scope, (state) => {
    const charge = chargeTry(state, now, policy);
    if ("retryAt" in charge) {
      retryAt = charge.retryAt;
      return null;
    }
    return charge.next;
  });
  if (result.status === "off") return { allowed: true, state: null };
  if (result.status === "busy") return { allowed: false, retryAt: now + BUSY_RETRY_MS };
  return result.after ? { allowed: true, state: result.after } : { allowed: false, retryAt };
}

/** Forget scopes nobody has touched for two days (one query, now and then). */
async function maybePrune(): Promise<void> {
  if (Math.random() >= 0.05) return;
  const cutoff = new Date(Date.now() - 2 * DAY).toISOString();
  const { error } = await createAdminClient().from("kvk_unlock_throttle").delete().lt("updated_at", cutoff);
  if (error) log.warn("Could not prune the unlock throttle", { error: error.message });
}

export async function clearThrottle(scope: string): Promise<void> {
  if (!isSupabaseAdminConfigured()) return;
  const { error } = await createAdminClient().from("kvk_unlock_throttle").delete().eq("scope", scope);
  if (error) log.warn("Could not clear a throttle scope", { error: error.message });
}

/** How many different addresses guessed wrong for this page of the plan since `since` (for the alert). */
export async function countRecentAddresses(planId: string, since: number, area: KvkArea = "plan"): Promise<number> {
  if (!isSupabaseAdminConfigured()) return 0;
  const { count, error } = await createAdminClient()
    .from("kvk_unlock_throttle")
    .select("scope", { count: "exact", head: true })
    .like("scope", `${addressScopePrefix(planId, area)}%`)
    .gte("updated_at", new Date(since).toISOString());
  if (error) log.warn("Could not count guessing addresses", { error: error.message });
  return count ?? 0;
}
