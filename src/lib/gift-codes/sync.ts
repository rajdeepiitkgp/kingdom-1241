// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { audit, systemAudit } from "@/lib/admin/audit";
import type { CurrentUser } from "@/lib/auth/server";
import { readConfig, writeConfig } from "@/lib/config/app-config";
import { createLogger, elapsedMs } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { type FeedCode, KINGSHOT_GIFT_CODES_URL, parseGiftCodeFeed } from "./kingshot";
import {
  CHECK_COOLDOWN_MS,
  feedStale,
  type GiftCodeSource,
  type GiftCodeSyncState,
  nextSyncState,
  parseGiftCodeSyncState,
  planChangesHome,
  planGiftCodeSync,
  type StoredGiftCode,
} from "./sync-plan";

/**
 * The gift-code check (server only): kingshot.net's list of active codes (one
 * call), applied to the gift_codes table with the pure planGiftCodeSync, the
 * result kept in app_config "gift_code_sync" for the admin page. Runs hourly
 * (the Gift codes workflow → POST /api/gift-codes/sync) and from a moderator's
 * Check now. Never throws: kingshot.net being down leaves every code as it was.
 */

const log = createLogger("gift-codes");

const FEED_TIMEOUT_MS = 15_000;

export type GiftCodeSyncResult =
  | { status: "synced"; listed: number; added: string[]; ended: string[]; changed: boolean }
  | { status: "unavailable"; message: string; stale: boolean }
  | { status: "no_database" | "not_migrated" | "too_soon"; message: string };

async function fetchFeed(): Promise<FeedCode[] | null> {
  const started = performance.now();
  try {
    const response = await fetch(KINGSHOT_GIFT_CODES_URL, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FEED_TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) {
      log.warn("kingshot.net answered with an error", { status: response.status, elapsedMs: elapsedMs(started) });
      return null;
    }
    const codes = parseGiftCodeFeed(await response.json());
    if (!codes) log.warn("kingshot.net's answer isn't the list of codes it used to be", { elapsedMs: elapsedMs(started) });
    return codes;
  } catch (error) {
    log.warn("kingshot.net unreachable", { error: error instanceof Error ? error.message : String(error), elapsedMs: elapsedMs(started) });
    return null;
  }
}

export async function syncGiftCodes({ actor }: { actor: CurrentUser | null }): Promise<GiftCodeSyncResult> {
  if (!isSupabaseAdminConfigured()) return { status: "no_database", message: "The gift codes need the database." };
  const admin = createAdminClient();
  const started = performance.now();

  const { data, error } = await admin.from("gift_codes").select("id, code, source, expires_at, ended_at");
  if (error) {
    if (error.code === "42703") return { status: "not_migrated", message: "The database doesn't have the gift-code columns yet (migration 0018). Try again once the deploy has finished." };
    log.error("Could not read the gift codes", { error: error.message });
    return { status: "unavailable", message: "The gift codes could not be read from the database.", stale: true };
  }
  const iso = (value: unknown) => (typeof value === "string" ? new Date(Date.parse(value)).toISOString() : null);
  const stored: StoredGiftCode[] = (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    source: (row.source === "kingshot" ? "kingshot" : "manual") as GiftCodeSource,
    expiresAt: iso(row.expires_at),
    endedAt: iso(row.ended_at),
  }));

  let previous: GiftCodeSyncState;
  try {
    previous = parseGiftCodeSyncState(await readConfig(admin, "gift_code_sync"));
  } catch {
    previous = parseGiftCodeSyncState(null);
  }
  const now = Date.now();
  if (actor && previous.at && now - Date.parse(previous.at) < CHECK_COOLDOWN_MS) {
    return { status: "too_soon", message: "Checked a moment ago; try again in a minute." };
  }

  const feed = await fetchFeed();
  const at = new Date(now).toISOString();
  const state = nextSyncState(previous, feed ? feed.length : null, at, actor ? "now" : "hourly");
  const plan = feed ? planGiftCodeSync(stored, feed, now) : null;

  const added: string[] = [];
  const ended: string[] = [];
  let changed = false;
  if (plan) {
    if (plan.inserts.length > 0) {
      // A moderator may add the same code at the same moment: theirs stays, the next check takes it over.
      const { data: inserted, error: insertError } = await admin
        .from("gift_codes")
        .upsert(
          plan.inserts.map((row) => ({ code: row.code, expires_at: row.expiresAt, added_at: row.addedAt, source: "kingshot" })),
          { onConflict: "code", ignoreDuplicates: true },
        )
        .select("code");
      if (insertError) log.error("Could not add the new gift codes", { error: insertError.message });
      else added.push(...(inserted ?? []).map((row) => row.code as string));
    }
    for (const update of plan.updates) {
      const { source, expiresAt, endedAt } = update.changes;
      const { error: updateError } = await admin
        .from("gift_codes")
        .update({ ...(source ? { source } : {}), ...(expiresAt ? { expires_at: expiresAt } : {}), ...(endedAt === null ? { ended_at: null } : {}) })
        .eq("id", update.id);
      if (updateError) log.error("Could not update a gift code", { code: update.code, error: updateError.message });
    }
    if (plan.ends.length > 0) {
      const { error: endError } = await admin
        .from("gift_codes")
        .update({ ended_at: at })
        .in(
          "id",
          plan.ends.map((row) => row.id),
        );
      if (endError) log.error("Could not end the gift codes kingshot.net no longer lists", { error: endError.message });
      else ended.push(...plan.ends.map((row) => row.code));
    }
    if (plan.deletes.length > 0) {
      const { error: deleteError } = await admin
        .from("gift_codes")
        .delete()
        .in(
          "id",
          plan.deletes.map((row) => row.id),
        );
      if (deleteError) log.warn("Could not delete old gift codes", { error: deleteError.message });
    }
    changed = planChangesHome(plan);
  }

  try {
    await writeConfig(admin, "gift_code_sync", state);
  } catch (configError) {
    log.error("Could not store the check's result", { error: configError instanceof Error ? configError.message : String(configError) });
  }

  const summary = { ok: Boolean(feed), listed: feed?.length ?? null, added, ended };
  // A moderator's Check now is always in the change log; the hourly run only when a code came or went.
  if (actor) await audit(actor, "gift_codes.check", "gift_codes", null, summary);
  else if (added.length > 0 || ended.length > 0) await systemAudit("gift_codes.check", "gift_codes", null, summary);
  log.info("Gift codes checked", { by: state.by, ok: Boolean(feed), listed: feed?.length, added: added.length, ended: ended.length, deleted: plan?.deletes.length ?? 0, elapsedMs: elapsedMs(started) });

  if (!feed) {
    return { status: "unavailable", message: "kingshot.net didn't answer, so nothing changed. The codes on Home stay as they are; try again later, or add a code by hand.", stale: feedStale(previous, now) };
  }
  return { status: "synced", listed: feed.length, added, ended, changed };
}

/** The result in a moderator's words. */
export function checkMessage(result: GiftCodeSyncResult): string {
  if (result.status !== "synced") return result.message;
  return [
    `kingshot.net lists ${result.listed} working ${result.listed === 1 ? "code" : "codes"}.`,
    result.added.length > 0 ? `New on Home: ${result.added.join(", ")}.` : "Nothing new.",
    result.ended.length > 0 && `Ended (no longer listed): ${result.ended.join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
}
