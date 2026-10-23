import type { GameEvent } from "@/lib/data/types";
import { DAY, MINUTE } from "@/lib/time";

export interface Occurrence {
  event: GameEvent;
  start: Date;
  end: Date;
  /** "upcoming" | "live" | "ended" relative to `now`. */
  status: "upcoming" | "live" | "ended";
}

/**
 * The occurrence of an event that is live now, or the next one to start.
 * Returns null for a one-off event that has already ended.
 */
export function nextOccurrence(event: GameEvent, now: Date): Occurrence | null {
  const firstStart = new Date(event.startsAt).getTime();
  const durationMs = event.durationMinutes * MINUTE;
  if (Number.isNaN(firstStart)) return null;

  let start = firstStart;
  if (event.repeatEveryDays && event.repeatEveryDays > 0) {
    const period = event.repeatEveryDays * DAY;
    // Jump to the occurrence whose *end* is still in the future.
    if (now.getTime() > firstStart + durationMs) {
      const elapsed = now.getTime() - firstStart;
      const periodsPassed = Math.floor(elapsed / period);
      start = firstStart + periodsPassed * period;
      if (now.getTime() > start + durationMs) start += period;
    }
  } else if (now.getTime() > firstStart + durationMs) {
    return null;
  }

  const startDate = new Date(start);
  const endDate = new Date(start + durationMs);
  const status: Occurrence["status"] =
    now.getTime() < start ? "upcoming" : now.getTime() <= start + durationMs ? "live" : "ended";
  return { event, start: startDate, end: endDate, status };
}

/** Upcoming/live occurrences for a list of events, soonest first. */
export function upcomingOccurrences(events: GameEvent[], now: Date, limit?: number): Occurrence[] {
  const list = events
    .map((event) => nextOccurrence(event, now))
    .filter((o): o is Occurrence => o !== null)
    .sort((a, b) => {
      // Live events first, then by start time.
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return a.start.getTime() - b.start.getTime();
    });
  return typeof limit === "number" ? list.slice(0, limit) : list;
}
