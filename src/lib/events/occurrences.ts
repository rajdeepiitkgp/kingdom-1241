import type { GameEvent } from "@/lib/data/types";

/** What the occurrence rules read of an event (the browser gets a view with the texts in one language). */
export type EventSchedule = Pick<GameEvent, "startsAt" | "durationMinutes" | "timing" | "repeatEveryDays" | "alsoAfterDays">;
import { DAY, MINUTE } from "@/lib/time";

export interface Occurrence<E extends EventSchedule = EventSchedule> {
  event: E;
  start: Date;
  end: Date;
  /** "upcoming" | "live" | "ended" relative to `now`. */
  status: "upcoming" | "live" | "ended";
}

/** Midnight UTC of the day `ms` falls on. */
function startOfUtcDay(ms: number): number {
  return Math.floor(ms / DAY) * DAY;
}

/**
 * Where an occurrence starts and how long it lasts. An event whose times each
 * alliance picks is a whole UTC day (the game's day): its own start time and
 * length don't say when a given alliance plays it.
 */
function span(event: EventSchedule): { first: number; durationMs: number } | null {
  const start = new Date(event.startsAt).getTime();
  if (Number.isNaN(start)) return null;
  return event.timing === "alliance" ? { first: startOfUtcDay(start), durationMs: DAY } : { first: start, durationMs: event.durationMinutes * MINUTE };
}

/**
 * The occurrence of an event that is live now, or the next one to start.
 * A round may have a second day (`alsoAfterDays`, e.g. Tuesday and Thursday).
 * Returns null for a one-off event that has already ended.
 */
export function nextOccurrence<E extends EventSchedule>(event: E, now: Date): Occurrence<E> | null {
  const timing = span(event);
  if (!timing) return null;
  const { first, durationMs } = timing;
  const t = now.getTime();
  const offsets = event.alsoAfterDays && event.alsoAfterDays > 0 ? [0, event.alsoAfterDays * DAY] : [0];
  const period = event.repeatEveryDays && event.repeatEveryDays > 0 ? event.repeatEveryDays * DAY : null;

  // The round now falls in, the one before (a long occurrence or a second day may still run) and the next.
  const round = period ? Math.max(0, Math.floor((t - first) / period)) : 0;
  const rounds = period ? [round - 1, round, round + 1].filter((r) => r >= 0) : [0];
  let start: number | null = null;
  for (const r of rounds) {
    for (const offset of offsets) {
      const candidate = first + r * (period ?? 0) + offset;
      if (t <= candidate + durationMs && (start === null || candidate < start)) start = candidate;
    }
  }
  if (start === null) return null;

  const status: Occurrence["status"] = t < start ? "upcoming" : t <= start + durationMs ? "live" : "ended";
  return { event, start: new Date(start), end: new Date(start + durationMs), status };
}

/** Upcoming/live occurrences for a list of events, soonest first. */
export function upcomingOccurrences<E extends EventSchedule>(events: E[], now: Date, limit?: number): Occurrence<E>[] {
  const list = events
    .map((event) => nextOccurrence(event, now))
    .filter((o): o is Occurrence<E> => o !== null)
    .sort((a, b) => {
      // Live events first, then by start time.
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return a.start.getTime() - b.start.getTime();
    });
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

/** Whole UTC days from today to the occurrence's day (0 = today, 1 = tomorrow). */
export function daysUntil(start: Date, now: Date): number {
  return Math.round((startOfUtcDay(start.getTime()) - startOfUtcDay(now.getTime())) / DAY);
}

/**
 * The days of one round as UTC weekdays ("Tue + Thu"), when a round has a
 * second day and repeats in whole weeks (so the weekdays never change).
 */
export function roundWeekdays(event: EventSchedule, locale: string): string | null {
  if (!event.alsoAfterDays || !event.repeatEveryDays || event.repeatEveryDays % 7 !== 0) return null;
  const start = new Date(event.startsAt).getTime();
  if (Number.isNaN(start)) return null;
  try {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    return `${weekday.format(start)} + ${weekday.format(start + event.alsoAfterDays * DAY)}`;
  } catch {
    return null;
  }
}
