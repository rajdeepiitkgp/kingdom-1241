import { pad2 } from "@/lib/time";

/**
 * The timing of Rally Sync (pure, unit-tested; shared by the server actions
 * and the room page). Moments are milliseconds since the epoch, durations
 * whole seconds:
 *
 *   start          = hit − rally timer − march          (per leader)
 *   earliest hit   = now + rally timer + longest march + buffer   (the coordinator's "Re-sync")
 *   counter-rally  = enemy hit + offset
 *
 * A countdown counts the way the in-game clock does: during the second that
 * shows the start time it reads 0 (GO), one second earlier 1, and so on, so
 * the number, the beeps and the game clock all change together.
 */

export const DEFAULT_RALLY_WAIT_SECONDS = 300;
export const DEFAULT_BUFFER_SECONDS = 120;
export const DEFAULT_COUNTER_OFFSET_SECONDS = 3;

export const MIN_RALLY_WAIT_SECONDS = 10;
export const MAX_RALLY_WAIT_SECONDS = 3600;
export const MAX_BUFFER_SECONDS = 600;
export const MAX_COUNTER_OFFSET_SECONDS = 10;
export const MAX_MARCH_SECONDS = 3600;

/**
 * The game clock is the source of truth: the hit time and every start time
 * are game-clock times, the same on every screen. A device's adjustment says
 * how many seconds the game clock is ahead of true UTC on that player's view
 * (default 0, i.e. game clock = UTC); it only moves that device's "now", so its
 * countdown and beeps reach zero when its game clock shows the start time.
 * A coordinator's typed times are game times as they are; their Re-sync and
 * "lands in" count from their own game "now".
 */
export const MAX_GAME_OFFSET_SECONDS = 60;

export function clampGameOffset(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  return Math.max(-MAX_GAME_OFFSET_SECONDS, Math.min(MAX_GAME_OFFSET_SECONDS, n));
}

/** The game clock's "now" for a device with this adjustment, from the true (server-corrected) now. */
export function toGameTime(ms: number, offsetSeconds: number): number {
  return ms + offsetSeconds * SECOND;
}

/** Card stages by seconds left until a leader's start. */
export const GET_READY_SECONDS = 60;
export const HIGH_ALERT_SECONDS = 15;
/** Short beeps from here down to 1, then the GO tone at 0. */
export const BEEP_FROM_SECONDS = 5;
/** How long the GO flash stays after the start second. */
export const GO_SECONDS = 5;

export type StartStage = "waiting" | "ready" | "alert" | "go" | "passed";

const SECOND = 1000;

/** When a leader taps "start rally" so the rally lands at `hitAt`. */
export function startAt(hitAt: number, rallyWaitSeconds: number, marchSeconds: number): number {
  return hitAt - (rallyWaitSeconds + marchSeconds) * SECOND;
}

export function ceilToSecond(ms: number): number {
  return Math.ceil(ms / SECOND) * SECOND;
}

/** The earliest hit every leader can still make from `now`, plus the buffer, on a whole second. */
export function earliestHit(now: number, rallyWaitSeconds: number, marchSeconds: readonly number[], bufferSeconds: number): number {
  const longest = marchSeconds.reduce((max, s) => Math.max(max, s), 0);
  return ceilToSecond(now + (rallyWaitSeconds + longest + bufferSeconds) * SECOND);
}

/** Counter-rally: our rallies land `offsetSeconds` after the enemy's. */
export function counterHit(enemyHitAt: number, offsetSeconds: number): number {
  return enemyHitAt + offsetSeconds * SECOND;
}

/** Whole seconds until `at` as a clock shows them: 0 during the second of `at`, negative afterwards. */
export function secondsUntil(at: number, now: number): number {
  return Math.ceil((at - now) / SECOND) || 0; // no -0 during the start second
}

export function startStage(start: number, now: number): StartStage {
  const left = secondsUntil(start, now);
  if (left > GET_READY_SECONDS) return "waiting";
  if (left > HIGH_ALERT_SECONDS) return "ready";
  if (left > 0) return "alert";
  if (left > -GO_SECONDS) return "go";
  return "passed";
}

/** A leader whose start was already over when the hit time was set can't make that hit. */
export function isTooLate(start: number, hitSetAt: number | null): boolean {
  return hitSetAt !== null && start < ceilToSecond(hitSetAt);
}

export interface TimedLeader {
  name: string;
  marchSeconds: number;
}

/**
 * Leaders with their start times, earliest start first (the longest march
 * starts first; without a hit time the order is the same). Ties by name.
 */
export function withStartTimes<T extends TimedLeader>(leaders: readonly T[], hitAt: number | null, rallyWaitSeconds: number): Array<T & { startAt: number | null }> {
  return leaders
    .map((leader) => ({ ...leader, startAt: hitAt === null ? null : startAt(hitAt, rallyWaitSeconds, leader.marchSeconds) }))
    .sort((a, b) => b.marchSeconds - a.marchSeconds || a.name.localeCompare(b.name));
}

export type SoundCue = { at: number; kind: "chime" } | { at: number; kind: "tick"; step: number } | { at: number; kind: "go" };

/**
 * What a leader's device plays before their start: one soft chime when "get
 * ready" begins, short beeps at 5 … 1 (step 0 … 4, each a little higher and
 * louder) and the GO tone on the start second.
 */
export function soundCues(start: number): SoundCue[] {
  const cues: SoundCue[] = [{ at: start - GET_READY_SECONDS * SECOND, kind: "chime" }];
  for (let left = BEEP_FROM_SECONDS; left >= 1; left--) cues.push({ at: start - left * SECOND, kind: "tick", step: BEEP_FROM_SECONDS - left });
  cues.push({ at: start, kind: "go" });
  return cues;
}

/** "272", "4:32" (or "4 32") or "1:04:32" → seconds; null for anything else. */
export function parseDuration(text: string): number | null {
  const parts = text.trim().split(/\s*[:\s]\s*/);
  if (parts.length > 3 || parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  const numbers = parts.map(Number);
  if (numbers.length > 1 && numbers.slice(1).some((n) => n >= 60)) return null;
  return numbers.reduce((total, n) => total * 60 + n, 0);
}

/**
 * "14:02:27", "14:02", "14.02.27", "14 02 27" or "140227" in UTC → the moment
 * with that clock time, today or tomorrow: a time more than an hour ago means
 * tomorrow (typing 00:05 at 23:50), a time within the last hour stays today,
 * so a typo of a moment that just passed is reported instead of silently
 * moved by a day.
 */
export function parseUtcClock(text: string, now: number): number | null {
  const trimmed = text.trim();
  const compact = /^\d{4}(\d{2})?$/.test(trimmed) ? trimmed.match(/\d{2}/g) : null;
  const parts = compact ?? /^(\d{1,2})[:.\s]\s*(\d{2})(?:[:.\s]\s*(\d{2}))?$/.exec(trimmed)?.slice(1);
  if (!parts) return null;
  const [hours, minutes, seconds] = [Number(parts[0]), Number(parts[1]), Number(parts[2] ?? 0)];
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const day = new Date(now);
  const candidate = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours, minutes, seconds);
  return candidate < now - 3600 * SECOND ? candidate + 24 * 3600 * SECOND : candidate;
}

/** 42 → "0:42", 272 → "4:32", 3723 → "1:02:03"; negative values get a minus. */
export function formatSeconds(total: number): string {
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(total));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  return hours > 0 ? `${sign}${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${sign}${minutes}:${pad2(seconds)}`;
}
