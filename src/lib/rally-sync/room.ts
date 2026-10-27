// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { HOUR, MINUTE } from "@/lib/time";
import {
  DEFAULT_BUFFER_SECONDS,
  DEFAULT_COUNTER_OFFSET_SECONDS,
  DEFAULT_RALLY_WAIT_SECONDS,
  MAX_BUFFER_SECONDS,
  MAX_COUNTER_OFFSET_SECONDS,
  MAX_MARCH_SECONDS,
  MAX_RALLY_WAIT_SECONDS,
  MIN_RALLY_WAIT_SECONDS,
} from "./timing";
import type { GarrisonState } from "./garrison";

/**
 * Rooms of Rally Sync (pure, unit-tested; storage in store.ts, the rules are
 * repeated in migration 0012 where the database enforces them). A room is
 * opened with its code + password or the invite link, lives while somebody
 * has it on screen and is never older than a day.
 */

/**
 * What a room is for, chosen when it is created: "rally" times our attack (start = hit − rally timer − march),
 * "counter" gives the counter alliance its launch order (counter.ts), "garrison" times refills between enemy
 * hits (garrison.ts). Each is run by different players, so a room never changes what it is.
 */
export type RoomMode = "rally" | "counter" | "garrison";
export const ROOM_MODES: readonly RoomMode[] = ["rally", "counter", "garrison"];

export function canSwitchMode(from: RoomMode, to: RoomMode): boolean {
  return from === to;
}

/** No 0/O and no 1/I/L, so a code read out in voice chat can't be mistyped. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export const MAX_OPEN_ROOMS = 3;
export const MAX_LEADERS_PER_ROOM = 10;
export const MAX_LEADERS_TOTAL = 15;
/** Browsers (instances) per room, as in migration 0014. */
export const MAX_INSTANCES_PER_ROOM = 50;
export const INSTANCE_TAG_LENGTH = 4;
/** A room closes after this long without anybody on the page … */
export const IDLE_CLOSE_MS = 30 * MINUTE;
/** … and a day after it was created at the latest. */
export const MAX_ROOM_AGE_MS = 24 * HOUR;
/** Open pages check in this often (only while on screen). */
export const HEARTBEAT_MS = 3 * MINUTE;
export const HISTORY_LENGTH = 10;

export const TITLE_MAX = 40;
export const NAME_MAX = 30;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

/** A random room code; `randomByte` returns 0–255 (crypto in production, a sequence in tests). Rejection sampling keeps every letter equally likely. */
export function randomRoomCode(randomByte: () => number): string {
  const limit = 256 - (256 % ROOM_CODE_ALPHABET.length);
  let code = "";
  while (code.length < ROOM_CODE_LENGTH) {
    const byte = randomByte();
    if (byte < limit) code += ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

/** What a player typed ("k7m 4qx", "K7M-4QX") as a code, or null when it can't be one. */
export function normalizeRoomCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== ROOM_CODE_LENGTH) return null;
  return [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null;
}

/** The random label of an instance without a name ("Watcher K7M4"): the room-code alphabet, so it reads out the same way. */
export function randomInstanceTag(randomByte: () => number): string {
  return randomRoomCode(randomByte).slice(0, INSTANCE_TAG_LENGTH);
}

/** "K7M4QX" → "K7M 4QX" (easier to read out). */
export function formatRoomCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

export interface RoomClock {
  lastSeenAt: string;
  createdAt: string;
}

/** When the room closes unless somebody opens it before (ms since epoch). */
export function roomClosesAt(room: RoomClock): number {
  return Math.min(Date.parse(room.lastSeenAt) + IDLE_CLOSE_MS, Date.parse(room.createdAt) + MAX_ROOM_AGE_MS);
}

export function isRoomOpen(room: RoomClock, now: number): boolean {
  return now < roomClosesAt(room);
}

export interface HitHistoryEntry {
  /** The hit time (ISO). */
  hitAt: string;
  /** When it was set (ISO). */
  setAt: string;
}

/** The history column as stored (tolerant: anything malformed is dropped). */
export function parseHistory(value: unknown): HitHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is HitHistoryEntry => typeof e === "object" && e !== null && typeof e.hitAt === "string" && typeof e.setAt === "string")
    .slice(0, HISTORY_LENGTH);
}

/** The history after replacing the hit time: the old one goes on top, the oldest falls off. */
export function pushHistory(history: readonly HitHistoryEntry[], previous: HitHistoryEntry | null): HitHistoryEntry[] {
  if (!previous) return history.slice(0, HISTORY_LENGTH);
  return [previous, ...history].slice(0, HISTORY_LENGTH);
}

/** What a room page shows: never a hash or a token. */
export interface RoomView {
  code: string;
  title: string;
  mode: RoomMode;
  rallyWaitSeconds: number;
  bufferSeconds: number;
  counterOffsetSeconds: number;
  enemyHitAt: string | null;
  hitAt: string | null;
  hitSetAt: string | null;
  history: HitHistoryEntry[];
  /** Garrison mode: the enemy rally leaders and the incoming rallies (empty otherwise). */
  garrison: GarrisonState;
  /** Realtime topic the page listens on (only ever sent to visitors who unlocked the room). */
  channel: string;
  createdAt: string;
  lastSeenAt: string;
}

/**
 * Whether a leader takes part: "active" leaders are in the rally that is set
 * now; "next" leaders joined (or came back) while it was running and are in
 * from the next hit time; "inactive" leaders sit out (no start time, no
 * sounds, not counted by Re-sync) until they come back.
 */
export type LeaderStatus = "active" | "next" | "inactive";

export function parseLeaderStatus(value: unknown): LeaderStatus {
  return value === "next" || value === "inactive" ? value : "active";
}

export interface LeaderView {
  id: string;
  name: string;
  marchSeconds: number;
  status: LeaderStatus;
  /** A march time the leader changed while a rally was running: it waits for the next hit time (see leaderEdit). */
  nextMarchSeconds: number | null;
  previousMarchSeconds: number | null;
  marchChangedAt: string | null;
}

/** The visitor's own instance (browser), as their page sees it; null for a cookie from before instances existed. */
export interface InstanceSelf {
  tag: string;
  name: string | null;
}

/** The answer of GET /api/rally-sync/[code]. */
export interface RoomState {
  room: RoomView;
  leaders: LeaderView[];
  me: InstanceSelf | null;
  /** The server's clock when the answer was made, for the page's clock correction. */
  serverNow: number;
}

// ---------------------------------------------------------------------------
// Instances: every browser in a room (the coordinator's "In the room" list)
// ---------------------------------------------------------------------------

/** One instance in the coordinator's list: never a token or a cookie, only what helps to tell them apart. */
export interface InstanceView {
  id: string;
  tag: string;
  name: string | null;
  /** Names of the leaders this instance added (one player may run two browsers, each with a leader). */
  leaders: string[];
  coordinator: boolean;
  /** The coordinator's own instance (it can't remove itself). */
  me: boolean;
  lastSeenAt: string;
}

/** How an instance is called: its own name, else its leaders' names, else "Watcher" + tag (the page words it). */
export function instanceLabel(instance: Pick<InstanceView, "name" | "leaders" | "tag">): { kind: "name" | "leaders" | "watcher"; text: string } {
  if (instance.name) return { kind: "name", text: instance.name };
  if (instance.leaders.length > 0) return { kind: "leaders", text: instance.leaders.join(", ") };
  return { kind: "watcher", text: instance.tag };
}

/** The coordinator's list: their own instance first, then the most recently active. */
export function sortInstances<T extends Pick<InstanceView, "me" | "lastSeenAt">>(instances: readonly T[]): T[] {
  return [...instances].sort((a, b) => Number(b.me) - Number(a.me) || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

/** An instance's own name: like a leader's name, or empty to go back to its tag. */
export function parseInstanceName(value: unknown): Parsed<string | null> {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { ok: true, value: null };
  return name.length <= NAME_MAX ? { ok: true, value: name } : { ok: false };
}

// ---------------------------------------------------------------------------
// March time changes during a rally
// ---------------------------------------------------------------------------

/** A rally is running: the hit time is set and still ahead (`now` on the game clock). */
export function rallyRunning(hitAt: string | null, now: number): boolean {
  return hitAt !== null && Date.parse(hitAt) > now;
}

/** The march time the next hit time is worked out with: the one waiting for the next rally, if any. */
export function nextRallyMarch(leader: Pick<LeaderView, "marchSeconds" | "nextMarchSeconds">): number {
  return leader.nextMarchSeconds ?? leader.marchSeconds;
}

/** The march times Re-sync plans the next rally with: everyone but those sitting out, with their next-rally values. */
export function resyncMarches(leaders: ReadonlyArray<Pick<LeaderView, "marchSeconds" | "nextMarchSeconds" | "status">>): number[] {
  return leaders.filter((l) => l.status !== "inactive").map(nextRallyMarch);
}

/** A new leader: in the rally at once, unless one is already running (then from the next one). */
export function joinStatus(running: boolean): LeaderStatus {
  return running ? "next" : "active";
}

/**
 * Sitting out or coming back (the leader or the coordinator). Sitting out
 * applies at once: it changes nobody else's times. Coming back during a
 * running rally counts from the next one, like joining.
 */
export function statusAfter(current: LeaderStatus, active: boolean, running: boolean): LeaderStatus {
  if (!active) return "inactive";
  return current === "inactive" ? joinStatus(running) : current;
}

export interface LeaderEdit {
  name: string;
  marchSeconds?: number;
  nextMarchSeconds: number | null;
  previousMarchSeconds?: number;
  marchChangedAt?: string;
}

/**
 * What saving a leader's entry writes. While a rally is running, a leader in
 * it must not move their own start in the middle of the countdown with a new
 * march time: it waits in `nextMarchSeconds` until the coordinator sets the
 * next hit time (typing the current value again cancels it). Otherwise, and
 * always for the coordinator (who is in charge and can Re-sync), it applies at
 * once; during a rally the old value is kept so the cards can flag "start
 * time changed". A coordinator's edit that leaves the march time alone (a name
 * fix) keeps a leader's waiting value.
 */
export function leaderEdit(
  leader: Pick<LeaderView, "marchSeconds" | "nextMarchSeconds" | "status">,
  input: { name: string; marchSeconds: number },
  { running, byCoordinator, at }: { running: boolean; byCoordinator: boolean; at: string },
): LeaderEdit {
  // Only a leader who is in the running rally has a start to protect.
  const inRally = running && leader.status === "active";
  if (inRally && !byCoordinator) {
    return { name: input.name, nextMarchSeconds: input.marchSeconds === leader.marchSeconds ? null : input.marchSeconds };
  }
  const changed = input.marchSeconds !== leader.marchSeconds;
  return {
    name: input.name,
    marchSeconds: input.marchSeconds,
    nextMarchSeconds: byCoordinator && !changed ? leader.nextMarchSeconds : null,
    ...(changed && inRally ? { previousMarchSeconds: leader.marchSeconds, marchChangedAt: at } : {}),
  };
}

/** The march time changed after the hit time was set, so this leader's start moved. */
export function startChanged(leader: Pick<LeaderView, "marchChangedAt" | "previousMarchSeconds" | "marchSeconds">, hitSetAt: string | null): boolean {
  if (!leader.marchChangedAt || !hitSetAt || leader.previousMarchSeconds === null) return false;
  return leader.previousMarchSeconds !== leader.marchSeconds && Date.parse(leader.marchChangedAt) > Date.parse(hitSetAt);
}

// ---------------------------------------------------------------------------
// Input checks (the forms check the same; the server is the authority)
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false };

/** An in-game name: trimmed, inner whitespace collapsed, 1–30 characters. */
export function parseName(value: unknown): Parsed<string> {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return name.length >= 1 && name.length <= NAME_MAX ? { ok: true, value: name } : { ok: false };
}

export function parseTitle(value: unknown): Parsed<string> {
  const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return title.length <= TITLE_MAX ? { ok: true, value: title } : { ok: false };
}

/** Room password: 6–64 characters after trimming (compared trimmed too). */
export function parsePassword(value: unknown): Parsed<string> {
  const password = typeof value === "string" ? value.trim() : "";
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX ? { ok: true, value: password } : { ok: false };
}

/** March time from the form: seconds (the main field) plus optional minutes, 1 s – 1 h in whole seconds. */
export function parseMarch(seconds: unknown, minutes?: unknown): Parsed<number> {
  const s = wholeNumber(seconds);
  const m = minutes === undefined || minutes === null || minutes === "" ? 0 : wholeNumber(minutes);
  if (s === null || m === null) return { ok: false };
  const total = m * 60 + s;
  return total >= 1 && total <= MAX_MARCH_SECONDS ? { ok: true, value: total } : { ok: false };
}

function wholeNumber(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (text === "") return typeof value === "string" ? 0 : null;
  return /^\d{1,5}$/.test(text) ? Number(text) : null;
}

export interface RoomSettings {
  mode: RoomMode;
  rallyWaitSeconds: number;
  bufferSeconds: number;
  counterOffsetSeconds: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  mode: "rally",
  rallyWaitSeconds: DEFAULT_RALLY_WAIT_SECONDS,
  bufferSeconds: DEFAULT_BUFFER_SECONDS,
  counterOffsetSeconds: DEFAULT_COUNTER_OFFSET_SECONDS,
};

/** The coordinator's settings, each within its range (rally timer 10 s – 1 h, buffer 0–10 min, offset 0–10 s). */
export function parseSettings(input: { mode?: unknown; rallyWaitSeconds?: unknown; bufferSeconds?: unknown; counterOffsetSeconds?: unknown }): Parsed<RoomSettings> {
  const mode = ROOM_MODES.find((m) => m === input.mode);
  const wait = inRange(input.rallyWaitSeconds, MIN_RALLY_WAIT_SECONDS, MAX_RALLY_WAIT_SECONDS);
  const buffer = inRange(input.bufferSeconds, 0, MAX_BUFFER_SECONDS);
  // No form asks for the offset any more (counter rooms give a launch order); the column keeps its default.
  const offset = input.counterOffsetSeconds === undefined || input.counterOffsetSeconds === "" ? DEFAULT_COUNTER_OFFSET_SECONDS : inRange(input.counterOffsetSeconds, 0, MAX_COUNTER_OFFSET_SECONDS);
  if (!mode || wait === null || buffer === null || offset === null) return { ok: false };
  return { ok: true, value: { mode, rallyWaitSeconds: wait, bufferSeconds: buffer, counterOffsetSeconds: offset } };
}

function inRange(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d{1,5}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
