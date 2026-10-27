"use client";

import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { offsetLabel, PET_BOOST_MINUTES, petsWindow } from "@/lib/kvk/leaders";
import { formatLocalDateTime, formatLocalTime, formatUtcRange, formatUtcTime } from "@/lib/time";
import { useNow } from "../time/useNow";

/**
 * A rally's times. Server HTML and the first client render show UTC only;
 * the visitor's own zone is added once hydrated (useNow), so the markup
 * never mismatches.
 */

/**
 * When to start the rally: local date and time plus UTC, or "when your
 * coordinator calls it". `compact` (the overview list): the clock time only,
 * nothing when there is no start time.
 */
export function RallyStart({ startAt, dict, locale, compact = false }: { startAt: string | null; dict: Dictionary; locale: string; compact?: boolean }) {
  const now = useNow(60_000);
  if (!startAt) return compact ? null : <>{dict["leaders.startCalled"]}</>;
  const start = new Date(startAt);
  if (compact) {
    return (
      <span dir="ltr" className="whitespace-nowrap tabular" suppressHydrationWarning>
        {now ? formatLocalTime(start, locale) : formatUtcTime(start)}
      </span>
    );
  }
  return (
    <span suppressHydrationWarning>
      {now && <>{formatLocalDateTime(start, locale)} </>}
      <span className={now ? "text-xs font-semibold whitespace-nowrap text-ink-faint" : "whitespace-nowrap"} dir="ltr">
        {now ? `(${formatUtcTime(start)})` : formatUtcTime(start)}
      </span>
    </span>
  );
}

/**
 * When to activate pets: "At the battle start" or "2 hrs after the start", and
 * the 2-hour boost that follows, as clock times once the battle time is known.
 */
export function PetsTime({ offsetMinutes, battleAt, dict, locale }: { offsetMinutes: number; battleAt: string | null; dict: Dictionary; locale: string }) {
  const now = useNow(60_000);
  const units = { hours: dict["common.hours"], minutes: dict["common.minutes"] };
  const label = offsetMinutes === 0 ? dict["leaders.pets.start"] : format(dict["leaders.pets.after"], { time: offsetLabel(offsetMinutes, units) });
  const boost = petsWindow(battleAt, offsetMinutes);
  return (
    <span suppressHydrationWarning>
      {label}
      <span className="block text-xs font-semibold text-ink-muted">
        {format(dict["leaders.pets.boost"], { time: offsetLabel(PET_BOOST_MINUTES, units) })}
        {boost && (
          <>
            {": "}
            {now && <>{formatLocalDateTime(boost.from, locale)} – {formatLocalTime(boost.to, locale)} </>}
            <span className="whitespace-nowrap text-ink-faint" dir="ltr">
              {now ? `(${formatUtcRange(boost.from, boost.to)})` : formatUtcRange(boost.from, boost.to)}
            </span>
          </>
        )}
      </span>
    </span>
  );
}
