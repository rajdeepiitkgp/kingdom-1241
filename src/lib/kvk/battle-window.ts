import { DAY, HOUR } from "@/lib/time";

/**
 * The kingdom's usual battle window (pure, unit-tested). Castle battles and KvK
 * generally run 12:00–19:00 UTC; the editor offers it in one click and every
 * plan can still set its own times.
 */
export const STANDARD_BATTLE = { startHourUtc: 12, endHourUtc: 19 } as const;

/** Length of the standard window in minutes (used while a plan has no times yet). */
export const STANDARD_BATTLE_MINUTES = (STANDARD_BATTLE.endHourUtc - STANDARD_BATTLE.startHourUtc) * 60;

/**
 * Start and end of the standard window as `datetime-local` values (UTC), on the
 * day of `startInput` when one is entered, else on the next day that still has
 * the whole window ahead of `now`.
 */
export function standardWindow(startInput: string, now: Date): { start: string; end: string } {
  const typed = /^\d{4}-\d{2}-\d{2}/.exec(startInput)?.[0];
  let day = typed;
  if (!day) {
    const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), STANDARD_BATTLE.startHourUtc);
    day = new Date(now.getTime() < todayStart ? todayStart : todayStart + DAY).toISOString().slice(0, 10);
  }
  const hh = (h: number) => String(h).padStart(2, "0");
  return { start: `${day}T${hh(STANDARD_BATTLE.startHourUtc)}:00`, end: `${day}T${hh(STANDARD_BATTLE.endHourUtc)}:00` };
}

/** Battle length in minutes from the plan's times, or the standard length when they are not both set. */
export function battleMinutes(battleAt: string | null, battleEndAt: string | null): number {
  const start = battleAt ? Date.parse(battleAt) : Number.NaN;
  const end = battleEndAt ? Date.parse(battleEndAt) : Number.NaN;
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return STANDARD_BATTLE_MINUTES;
  return Math.round((end - start) / (HOUR / 60));
}
