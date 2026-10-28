// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { audit, systemAudit } from "@/lib/admin/audit";
import type { CurrentUser } from "@/lib/auth/server";
import { readConfig, writeConfig } from "@/lib/config/app-config";
import { getSettings } from "@/lib/data";
import { createLogger, elapsedMs } from "@/lib/log";
import { MIGHTPULSE_API, mightPulseConfigured } from "@/lib/retro/mightpulse";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { type AllianceBoard, type MightPulseAlliance, parseAllianceInfo, parseBoard } from "./mightpulse-data";
import { type AllianceSyncState, battleHold, battleRows, lookupTag, parseAllianceSyncState, planSync, SYNC_COOLDOWN_MS, type StoredAlliance, syncState } from "./sync-plan";

/**
 * The alliance sync (server only): the kingdom's power ranking from MightPulse
 * (one call), then every alliance on our list by its tag (one call each, in
 * parallel; fresher than the ranking, which is the fallback when one of them
 * fails). Writes tag, name, power, leader and members of every alliance it
 * found, links unlinked ones, and keeps the result and the ranking in
 * app_config "alliance_sync" for the settings page. Runs daily (Maintenance
 * → POST /api/alliances/sync) and from the owner's Sync now. Never throws:
 * MightPulse being down leaves every row as it was.
 */

const log = createLogger("alliances");

const BOARD_TIMEOUT_MS = 30_000;
/** MightPulse fetches an alliance older than an hour from the game first (up to 90 s on its side). */
const DETAILS_TIMEOUT_MS = 60_000;

export type AllianceSyncResult =
  | { status: "synced"; synced: number; missing: string[]; renamed: string[]; battleDay: boolean }
  | { status: "unavailable" | "not_configured" | "no_database" | "not_migrated" | "too_soon"; message: string };

async function mightPulse(path: string, timeoutMs: number): Promise<unknown> {
  const key = process.env.MIGHTPULSE_API_KEY?.trim();
  if (!key) return null;
  const started = performance.now();
  try {
    const response = await fetch(`${MIGHTPULSE_API}${path}`, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) {
      // 404 = no such tag, 401 = key problem, 429 = over the budget, 5xx = their side.
      log.warn("MightPulse answered with an error", { path, status: response.status, elapsedMs: elapsedMs(started) });
      return null;
    }
    return await response.json();
  } catch (error) {
    log.warn("MightPulse unreachable", { path, error: error instanceof Error ? error.message : String(error), elapsedMs: elapsedMs(started) });
    return null;
  }
}

/** The kingdom's ranking (null when that call failed) and each listed alliance by its tag (null where that call failed). */
export async function fetchFromMightPulse(kingdom: number, rows: readonly StoredAlliance[]): Promise<{ board: AllianceBoard | null; details: Map<string, MightPulseAlliance | null> }> {
  const board = parseBoard(await mightPulse(`/kingdoms/${kingdom}/ranks?board=alliance_power&limit=100`, BOARD_TIMEOUT_MS));
  const ranking = board?.rows ?? [];
  const details = new Map<string, MightPulseAlliance | null>(
    await Promise.all(
      rows.map(async (row) => [row.id, parseAllianceInfo(await mightPulse(`/alliances/${kingdom}/${encodeURIComponent(lookupTag(row, ranking))}?include=info`, DETAILS_TIMEOUT_MS))] as const),
    ),
  );
  return { board, details };
}

/** The battle date of the active battle plan, in case a battle moved off the usual Saturday; null on any problem. */
async function activeBattleAt(admin: ReturnType<typeof createAdminClient>): Promise<string | null> {
  const { data, error } = await admin.from("kvk_plans").select("battle_at").eq("active", true).maybeSingle();
  if (error) log.warn("Could not read the active battle plan's date", { error: error.message });
  return typeof data?.battle_at === "string" ? data.battle_at : null;
}

export async function syncAlliances({ actor }: { actor: CurrentUser | null }): Promise<AllianceSyncResult> {
  if (!isSupabaseAdminConfigured()) return { status: "no_database", message: "The alliance sync needs the database." };
  if (!mightPulseConfigured()) return { status: "not_configured", message: "MIGHTPULSE_API_KEY isn't set, so nothing can be synced. Edit the numbers by hand." };
  const admin = createAdminClient();
  const started = performance.now();

  const { data, error } = await admin.from("alliances").select("id, tag, name, mightpulse_aid, power").order("sort_order");
  if (error) {
    if (error.code === "42703") return { status: "not_migrated", message: "The database doesn't have the alliance columns yet (migration 0017). Try again once the deploy has finished." };
    log.error("Could not read the alliances", { error: error.message });
    return { status: "unavailable", message: "The alliances could not be read from the database." };
  }
  const rows = (data ?? []).map((row) => ({
    id: row.id as string,
    tag: row.tag as string,
    name: row.name as string,
    aid: typeof row.mightpulse_aid === "number" ? row.mightpulse_aid : null,
    power: typeof row.power === "number" ? row.power : null,
  }));

  let previous: AllianceSyncState;
  try {
    previous = parseAllianceSyncState(await readConfig(admin, "alliance_sync"));
  } catch {
    previous = parseAllianceSyncState(null);
  }
  const now = Date.now();
  if (actor && previous.at && now - Date.parse(previous.at) < SYNC_COOLDOWN_MS) {
    return { status: "too_soon", message: "Synced a moment ago. MightPulse refreshes an alliance at most hourly; try again in a minute." };
  }

  const { kingdomNumber } = await getSettings();
  const { board, details } = await fetchFromMightPulse(kingdomNumber, [...rows, ...battleRows(previous.battle)]);
  const plan = planSync({ rows, battle: previous.battle, board, details, battleDay: battleHold(now, await activeBattleAt(admin)) });

  const at = new Date(now).toISOString();
  const missing = [...plan.missing];
  const renamed: string[] = [];
  const linked: string[] = [];
  let synced = 0;
  for (const write of plan.writes) {
    const { values } = write;
    const numbers = write.numbers ? { power: values.power, leader: values.leader, members: values.members, stats_source: "mightpulse", stats_at: at } : {};
    const { error: writeError } = await admin
      .from("alliances")
      .update({ mightpulse_aid: values.aid, tag: values.tag, name: values.name, ...numbers })
      .eq("id", write.id);
    if (writeError) {
      // 23505: the new tag or id is already on another row of the list.
      log.warn("Could not write a synced alliance", { tag: write.tag, code: writeError.code, error: writeError.message });
      missing.push(write.tag);
      continue;
    }
    synced += 1;
    if (write.renamedFrom) renamed.push(`${write.renamedFrom} → [${values.tag}] ${values.name}`);
    if (write.linked) linked.push(values.tag);
  }

  const reached = plan.reached;
  const state = syncState(plan, { synced, missing }, previous, board, at, actor ? "now" : "daily");
  try {
    await writeConfig(admin, "alliance_sync", state);
  } catch (configError) {
    log.error("Could not store the sync result", { error: configError instanceof Error ? configError.message : String(configError) });
  }

  const summary = { ok: reached, synced, missing, renamed, linked, battleDay: plan.battleDay };
  // The owner's button is always in the change log; the daily run only when something besides the numbers changed.
  if (actor) await audit(actor, "alliances.sync", "alliances", null, summary);
  else if (!reached || renamed.length > 0 || linked.length > 0 || missing.length > 0) await systemAudit("alliances.sync", "alliances", null, summary);
  log.info("Alliances synced", { by: state.by, ok: reached, battleDay: plan.battleDay, synced, missing: missing.length, renamed: renamed.length, linked: linked.length, elapsedMs: elapsedMs(started) });

  if (!reached) return { status: "unavailable", message: "MightPulse didn't answer, so nothing was changed. Try again later, or edit the numbers by hand." };
  return { status: "synced", synced, missing, renamed, battleDay: plan.battleDay };
}

/** The result in the owner's words. */
export function syncMessage(result: AllianceSyncResult): string {
  if (result.status !== "synced") return result.message;
  return [
    `Synced ${result.synced} ${result.synced === 1 ? "alliance" : "alliances"} from MightPulse.`,
    result.battleDay && "Battle day: the players are in [KvK] and [TMP], so power, members and leaders stay as they were before the battle (until noon UTC the day after).",
    result.renamed.length > 0 && `Renamed: ${result.renamed.join("; ")}.`,
    result.missing.length > 0 && `Not found: ${result.missing.map((tag) => `[${tag}]`).join(", ")} (check the tag, or edit by hand).`,
  ]
    .filter(Boolean)
    .join(" ");
}
