import { createHash } from "node:crypto";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAY } from "@/lib/time";
import { kvkSessionSecret } from "./access";
import type { ThrottleState } from "./throttle";

/** Storage for the unlock throttle (table kvk_unlock_throttle; server only). */

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
}

const COLUMNS = "scope, failures, window_started_at, locked_until, lockouts, alerted_at";

function toState(row: Row): ThrottleState {
  return {
    failures: Number(row.failures) || 0,
    windowStartedAt: Date.parse(row.window_started_at) || 0,
    lockedUntil: row.locked_until ? Date.parse(row.locked_until) || null : null,
    lockouts: Number(row.lockouts) || 0,
    alertedAt: row.alerted_at ? Date.parse(row.alerted_at) || null : null,
  };
}

/** States for the given scopes, in the same order; null for unknown scopes or when the table is unreachable. */
export async function loadThrottle(scopes: string[]): Promise<(ThrottleState | null)[]> {
  const { data, error } = await createAdminClient().from("kvk_unlock_throttle").select(COLUMNS).in("scope", scopes);
  if (error) {
    log.error("Could not read the unlock throttle", { error: error.message });
    return scopes.map(() => null);
  }
  const byScope = new Map((data as Row[]).map((row) => [row.scope, toState(row)]));
  return scopes.map((scope) => byScope.get(scope) ?? null);
}

export async function saveThrottle(entries: Array<{ scope: string; state: ThrottleState }>): Promise<void> {
  const admin = createAdminClient();
  const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);
  const rows = entries.map(({ scope, state }) => ({
    scope,
    failures: state.failures,
    window_started_at: new Date(state.windowStartedAt).toISOString(),
    locked_until: iso(state.lockedUntil),
    lockouts: state.lockouts,
    alerted_at: iso(state.alertedAt),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await admin.from("kvk_unlock_throttle").upsert(rows, { onConflict: "scope" });
  if (error) log.error("Could not save the unlock throttle", { error: error.message });
  // Forget scopes nobody has touched for two days (one query, now and then).
  if (Math.random() < 0.05) {
    const cutoff = new Date(Date.now() - 2 * DAY).toISOString();
    const { error: pruneError } = await admin.from("kvk_unlock_throttle").delete().lt("updated_at", cutoff);
    if (pruneError) log.warn("Could not prune the unlock throttle", { error: pruneError.message });
  }
}

export async function clearThrottle(scope: string): Promise<void> {
  const { error } = await createAdminClient().from("kvk_unlock_throttle").delete().eq("scope", scope);
  if (error) log.warn("Could not clear a throttle scope", { error: error.message });
}

/** How many different addresses guessed wrong for this plan since `since` (for the alert). */
export async function countRecentAddresses(planId: string, since: number): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("kvk_unlock_throttle")
    .select("scope", { count: "exact", head: true })
    .like("scope", `ip:${planId}:%`)
    .gte("updated_at", new Date(since).toISOString());
  if (error) log.warn("Could not count guessing addresses", { error: error.message });
  return count ?? 0;
}
