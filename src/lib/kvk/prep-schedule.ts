// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { type BuffDay, isBuffDay, type Ministry, MINISTRIES, nextRound, type PrepRound, type PrepSchedule, roundFor, TEMPLATE_SCHEDULE } from "./prep";

/**
 * The council's buff days per prep round (pure, unit-tested): which of Days
 * 1, 2 and 5 gets the construction and which the research minister buff. The
 * game scores the ministry items the same on all three days, so this is the
 * kingdom's strategy and is shown behind the battle plan's password only.
 * Moderators set it per round on /admin/prep; it is stored as one app_config
 * value, `{ rounds: { "<Day 0 of the round, UTC date>": { construction, research } } }`,
 * and a round without an entry follows the template (construction Day 1,
 * research Day 2). Rounds that are over are dropped at the next save.
 */

export type PrepSchedules = Record<string, PrepSchedule>;

/** The rounds the admin page offers: the one in progress (or next up) and the one after it. */
export function offeredRounds(now: Date): { current: PrepRound; next: PrepRound } {
  const current = roundFor(now);
  return { current, next: nextRound(current) };
}

/** `"2026-11-01"`: the round's Day 0 (Sunday) as a UTC date. */
export function roundKey(round: PrepRound): string {
  return round.start.toISOString().slice(0, 10);
}

const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The stored value as the site reads it: anything missing or malformed is left out. */
export function parsePrepSchedules(value: unknown): PrepSchedules {
  const stored = typeof value === "object" && value !== null ? (value as { rounds?: unknown }).rounds : null;
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const rounds: PrepSchedules = {};
  for (const [key, entry] of Object.entries(stored as Record<string, unknown>)) {
    if (!KEY.test(key) || typeof entry !== "object" || entry === null) continue;
    const days = entry as Record<string, unknown>;
    if (MINISTRIES.every((ministry) => isBuffDay(days[ministry]))) rounds[key] = { construction: days.construction as BuffDay, research: days.research as BuffDay };
  }
  return rounds;
}

/**
 * Local review without a database: `PREP_SCHEDULE_LOCAL='{"construction":5,"research":1}'`
 * gives the current and the next round that schedule (anything else: the
 * template). Read only where the database isn't configured, so Vercel never sees it.
 */
export function localSchedules(raw: string | undefined, now: Date): PrepSchedules {
  if (!raw?.trim()) return {};
  try {
    const value: unknown = JSON.parse(raw);
    const days = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    if (!MINISTRIES.every((ministry) => isBuffDay(days[ministry]))) return {};
    const schedule: PrepSchedule = { construction: days.construction as BuffDay, research: days.research as BuffDay };
    const { current, next } = offeredRounds(now);
    return { [roundKey(current)]: schedule, [roundKey(next)]: schedule };
  } catch {
    return {};
  }
}

/** The round's schedule: the council's, else the template. */
export function scheduleFor(rounds: PrepSchedules, round: PrepRound): PrepSchedule {
  return rounds[roundKey(round)] ?? TEMPLATE_SCHEDULE;
}

/** The value to store after a save: the new entry, every round from the current one on, nothing older. */
export function withRound(rounds: PrepSchedules, key: string, schedule: PrepSchedule, currentKey: string): { rounds: PrepSchedules } {
  const kept = Object.fromEntries(Object.entries(rounds).filter(([k]) => k >= currentKey));
  return { rounds: { ...kept, [key]: schedule } };
}

export const sameSchedule = (a: PrepSchedule, b: PrepSchedule): boolean => MINISTRIES.every((ministry) => a[ministry] === b[ministry]);

export type PrepScheduleFormResult = { ok: true; value: { round: string; schedule: PrepSchedule } } | { ok: false; errors: Record<string, string> };

/**
 * The admin form: the round (one of the rounds the page showed) and a day for
 * each ministry, 1, 2 or 5; both may be the same day.
 */
export function parsePrepScheduleForm(form: { get(name: string): unknown }, rounds: readonly string[]): PrepScheduleFormResult {
  const errors: Record<string, string> = {};
  const round = String(form.get("round") ?? "");
  if (!rounds.includes(round)) errors.round = "Pick one of the rounds shown.";
  const schedule = {} as Record<Ministry, BuffDay>;
  for (const ministry of MINISTRIES) {
    const raw = form.get(ministry);
    const day = typeof raw === "string" && /^\d$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
    if (isBuffDay(day)) schedule[ministry] = day;
    else errors[ministry] = "Day 1, 2 or 5.";
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: { round, schedule } };
}
