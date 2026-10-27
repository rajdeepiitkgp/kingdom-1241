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

/**
 * Rooms of Rally Sync (pure, unit-tested; storage in store.ts, the rules are
 * repeated in migration 0012 where the database enforces them). A room is
 * opened with its code + password or the invite link, lives while somebody
 * has it on screen and is never older than a day.
 */

export type RoomMode = "rally" | "counter";
export const ROOM_MODES: readonly RoomMode[] = ["rally", "counter"];

/** No 0/O and no 1/I/L, so a code read out in voice chat can't be mistyped. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export const MAX_OPEN_ROOMS = 3;
export const MAX_LEADERS_PER_ROOM = 10;
export const MAX_LEADERS_TOTAL = 15;
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
  /** Realtime topic the page listens on (only ever sent to visitors who unlocked the room). */
  channel: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface LeaderView {
  id: string;
  name: string;
  marchSeconds: number;
  previousMarchSeconds: number | null;
  marchChangedAt: string | null;
}

/** The answer of GET /api/rally-sync/[code]. */
export interface RoomState {
  room: RoomView;
  leaders: LeaderView[];
  /** The server's clock when the answer was made, for the page's clock correction. */
  serverNow: number;
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
  const offset = inRange(input.counterOffsetSeconds, 0, MAX_COUNTER_OFFSET_SECONDS);
  if (!mode || wait === null || buffer === null || offset === null) return { ok: false };
  return { ok: true, value: { mode, rallyWaitSeconds: wait, bufferSeconds: buffer, counterOffsetSeconds: offset } };
}

function inRange(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d{1,5}$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
