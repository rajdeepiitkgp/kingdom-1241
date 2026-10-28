// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { isBattleSaturday } from "@/lib/kvk/prep";
import { DAY, HOUR } from "@/lib/time";
import { type AllianceBoard, type MightPulseAlliance, parseStoredBoard } from "./mightpulse-data";

/**
 * What one alliance sync changes (pure, unit-tested; sync.ts makes the calls
 * and writes). An alliance on our list is found in MightPulse by the game's
 * alliance id once linked, so a new tag or name follows; before that (rows
 * from the seed or added by hand) the first sync links it by its tag. The
 * one-alliance answer is fresher than the daily ranking and wins, but only
 * when it is the same alliance: a tag can pass to another alliance. Nothing is
 * ever matched by power or place in the ranking.
 *
 * Only the alliances on the owner's list are ever shown (Home and the list);
 * an alliance that climbs the ranking is flagged for review, never added. The
 * kingdom's two battle alliances are looked up too, to show them apart; they
 * are never on the list or Home and never ranked with the others. On battle
 * days the players sit in those two, so the sync keeps the home alliances'
 * numbers (battleHold).
 */

/** The page flags an alliance not on the list that ranks within this (held for review), and one on the list that ranks below it. */
export const TOP_ALLIANCES = 6;
/** The daily run (Maintenance workflow schedule "7 6 * * *"). */
export const DAILY_SYNC_UTC = "06:07";
/** Sync now waits this long after the last sync: MightPulse refreshes an alliance at most hourly anyway. */
export const SYNC_COOLDOWN_MS = 60 * 1000;

/**
 * The battle alliances: for the castle battle and KvK every player joins one
 * ([KvK] rallies the castle, [TMP] counter-rallies), so on battle day they top
 * the ranking and the home alliances empty out. Recognised by this exact tag
 * the first time, then by the game's alliance id.
 */
export const BATTLE_ALLIANCE_TAGS: readonly string[] = ["KvK", "TMP"];
/** The players are back in their alliances by noon (UTC) the day after a battle. */
export const BATTLE_HOLD_AFTER = 12 * HOUR;

/**
 * A battle is on or just over: from 00:00 UTC on a battle day (every second
 * Saturday, isBattleSaturday, or the date of the active battle plan if it moved)
 * until noon the day after. The sync then keeps the alliances' power, members
 * and leaders from before the battle.
 */
export function battleHold(now: number, planBattleAt: string | null): boolean {
  const today = Math.floor(now / DAY) * DAY;
  const planned = planBattleAt ? Date.parse(planBattleAt) : Number.NaN;
  const planDay = Number.isNaN(planned) ? null : Math.floor(planned / DAY) * DAY;
  const battleOn = (day: number) => isBattleSaturday(day) || day === planDay;
  return battleOn(today) || (battleOn(today - DAY) && now - today < BATTLE_HOLD_AFTER);
}

export interface StoredAlliance {
  id: string;
  tag: string;
  name: string;
  aid: number | null;
}

/**
 * The ranking row with exactly this tag. Tags are case-sensitive in the game
 * ([NAM] and [Nam] are two alliances of 1241), so a tag in another case is a
 * different alliance, never a near match.
 */
export function rowByTag(board: readonly MightPulseAlliance[], tag: string): MightPulseAlliance | null {
  return board.find((ranked) => ranked.tag === tag) ?? null;
}

/** The ranking row of an alliance on our list: by its id once linked, by its tag before. */
export function rankedRow(row: StoredAlliance, board: readonly MightPulseAlliance[]): MightPulseAlliance | null {
  return row.aid !== null ? (board.find((ranked) => ranked.aid === row.aid) ?? null) : rowByTag(board, row.tag);
}

/** The tag to ask MightPulse for: the ranking's (the alliance may have a new one), else ours. */
export function lookupTag(row: StoredAlliance, board: readonly MightPulseAlliance[]): string {
  return rankedRow(row, board)?.tag ?? row.tag;
}

export type AllianceOutcome =
  | { id: string; tag: string; status: "synced"; values: MightPulseAlliance; linked: boolean; renamedFrom: string | null }
  | { id: string; tag: string; status: "missing" };

export function planAllianceSync(
  rows: readonly StoredAlliance[],
  board: readonly MightPulseAlliance[],
  details: ReadonlyMap<string, MightPulseAlliance | null>,
): AllianceOutcome[] {
  return rows.map((row) => {
    const ranked = rankedRow(row, board);
    const aid = row.aid ?? ranked?.aid ?? null;
    const info = details.get(row.id) ?? null;
    // Unlinked and not in the ranking: the answer is for exactly the tag we asked (MightPulse matches it case-sensitively).
    const fresh = info && (aid !== null ? info.aid === aid : info.tag === row.tag) ? info : null;
    const values = fresh ? { ...fresh, rank: fresh.rank ?? ranked?.rank ?? null } : ranked;
    if (!values) return { id: row.id, tag: row.tag, status: "missing" };
    const renamed = values.tag !== row.tag || values.name !== row.name;
    return { id: row.id, tag: row.tag, status: "synced", values, linked: row.aid === null, renamedFrom: renamed ? `[${row.tag}] ${row.name}` : null };
  });
}

/** The battle alliances to look up: by id once seen, by tag before. */
export function battleRows(known: readonly MightPulseAlliance[]): StoredAlliance[] {
  const seen = known.map((battle) => ({ id: `battle:${battle.aid}`, tag: battle.tag, name: battle.name, aid: battle.aid }));
  const unseen = BATTLE_ALLIANCE_TAGS.filter((tag) => !known.some((battle) => battle.tag === tag)).map((tag) => ({ id: `battle:${tag}`, tag, name: tag, aid: null }));
  return [...seen, ...unseen];
}

/** A battle alliance: one of the known ones by id, or by its exact tag. */
export function isBattleAlliance(alliance: { aid: number | null; tag: string }, known: readonly MightPulseAlliance[]): boolean {
  return (alliance.aid !== null && known.some((battle) => battle.aid === alliance.aid)) || BATTLE_ALLIANCE_TAGS.includes(alliance.tag);
}

/** The ranking without the battle alliances, so a home alliance keeps its place on battle day. */
export function homeRanking(board: readonly MightPulseAlliance[], known: readonly MightPulseAlliance[]): MightPulseAlliance[] {
  return board
    .filter((row) => !isBattleAlliance(row, known))
    .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface SyncInput {
  /** The alliances on our list, with their stored power. */
  rows: ReadonlyArray<StoredAlliance & { power: number | null }>;
  /** The battle alliances seen before (the last sync's state). */
  battle: readonly MightPulseAlliance[];
  board: AllianceBoard | null;
  /** MightPulse's answer per row id (ours and battleRows'), null where the call failed. */
  details: ReadonlyMap<string, MightPulseAlliance | null>;
  /** battleHold: keep the numbers, follow only tag and name. */
  battleDay: boolean;
}

export interface AllianceWrite {
  id: string;
  /** The tag before. */
  tag: string;
  values: MightPulseAlliance;
  /** Power, leader and members too (false on battle day: only tag and name follow). */
  numbers: boolean;
  linked: boolean;
  renamedFrom: string | null;
}

export interface SyncPlan {
  writes: AllianceWrite[];
  missing: string[];
  /** MightPulse answered at all. */
  reached: boolean;
  battleDay: boolean;
  battle: MightPulseAlliance[];
}

export function planSync({ rows, battle, board, details, battleDay }: SyncInput): SyncPlan {
  const ranking = board?.rows ?? [];
  const found = planAllianceSync(battleRows(battle), ranking, details).flatMap((outcome) => (outcome.status === "synced" ? [outcome.values] : []));
  // A battle alliance not answering this time keeps its last known self.
  const battleNow = [...found, ...battle.filter((known) => !found.some((now) => now.aid === known.aid) && !found.some((now) => now.tag === known.tag))];
  const writes: AllianceWrite[] = [];
  const missing: string[] = [];
  for (const outcome of planAllianceSync(rows, ranking, details)) {
    if (outcome.status === "missing" || isBattleAlliance(outcome.values, battleNow)) missing.push(outcome.tag);
    else writes.push({ id: outcome.id, tag: outcome.tag, values: outcome.values, numbers: !battleDay, linked: outcome.linked, renamedFrom: outcome.renamedFrom });
  }
  return { writes, missing, reached: board !== null || [...details.values()].some(Boolean), battleDay, battle: battleNow };
}

/** The last sync, kept in app_config "alliance_sync" for the settings page. */
export interface AllianceSyncState {
  /** When it ran (ISO), null before the first. */
  at: string | null;
  ok: boolean;
  /** Why it failed or what it couldn't find, in plain words. */
  problem: string | null;
  /** "daily" or "now" (the owner's button). */
  by: "daily" | "now" | null;
  synced: number;
  /** Tags of alliances on our list that MightPulse didn't have. */
  missing: string[];
  /** The last ranking that came through (kept when a later sync fails). */
  board: MightPulseAlliance[];
  boardAt: string | null;
  /** The battle alliances as last seen. */
  battle: MightPulseAlliance[];
  /** It ran on a battle day (battleHold): the alliances kept their numbers. */
  battleDay: boolean;
}

export const NO_SYNC_YET: AllianceSyncState = { at: null, ok: false, problem: null, by: null, synced: 0, missing: [], board: [], boardAt: null, battle: [], battleDay: false };

export function parseAllianceSyncState(value: unknown): AllianceSyncState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return NO_SYNC_YET;
  const stored = value as Record<string, unknown>;
  const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  return {
    at: iso(stored.at),
    ok: stored.ok === true,
    problem: typeof stored.problem === "string" ? stored.problem : null,
    by: stored.by === "daily" || stored.by === "now" ? stored.by : null,
    synced: typeof stored.synced === "number" ? stored.synced : 0,
    missing: Array.isArray(stored.missing) ? stored.missing.filter((tag): tag is string => typeof tag === "string") : [],
    board: parseStoredBoard(stored.board),
    boardAt: iso(stored.boardAt),
    battle: parseStoredBoard(stored.battle),
    battleDay: stored.battleDay === true,
  };
}

/** What a sync stores, from its plan and what was actually written. */
export function syncState(plan: SyncPlan, written: { synced: number; missing: string[] }, previous: AllianceSyncState, board: AllianceBoard | null, at: string, by: "daily" | "now"): AllianceSyncState {
  const problem = !plan.reached
    ? "MightPulse didn't answer (or refused the key)"
    : written.missing.length > 0
      ? `not found in MightPulse: ${written.missing.map((tag) => `[${tag}]`).join(", ")}`
      : null;
  return {
    at,
    ok: plan.reached,
    problem,
    by,
    synced: written.synced,
    missing: written.missing,
    board: board?.rows ?? previous.board,
    boardAt: board?.capturedAt ?? previous.boardAt,
    battle: plan.battle,
    battleDay: plan.battleDay,
  };
}

/** Alliances not on the list that rank within the top TOP_ALLIANCES (of the home ranking): held for the owner's review, never shown on their own. */
export function heldForReview(ranking: readonly MightPulseAlliance[], tracked: ReadonlySet<number>): MightPulseAlliance[] {
  return ranking.filter((row) => (row.rank ?? Number.MAX_SAFE_INTEGER) <= TOP_ALLIANCES && !tracked.has(row.aid));
}
