"use client";

import { Clock, RotateCcw } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatUtcClock, formatUtcDate, localTimeZone, nextDailyReset, pad2 } from "@/lib/time";
import { DurationUnits } from "./DurationLabel";
import { useNow } from "./useNow";

/** UTC server clock and countdown to the daily reset. */
export function ServerClock({
  dict,
  locale,
  resetHourUtc,
}: {
  dict: Dictionary;
  locale: string;
  resetHourUtc: number;
}) {
  const now = useNow(1000);
  const reset = now ? nextDailyReset(now, resetHourUtc) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="card flex items-center gap-4 px-5 py-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Clock className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{dict["time.serverTime"]}</p>
          <p className="tabular text-3xl font-black leading-tight text-ink" dir="ltr" suppressHydrationWarning>
            {now ? formatUtcClock(now) : "--:--:--"}
          </p>
          <p className="truncate text-xs font-semibold text-ink-faint" suppressHydrationWarning>
            {now ? `${formatUtcDate(now, locale)} · ${dict["time.yourTimeZone"]}: ${localTimeZone()}` : " "}
          </p>
        </div>
      </div>

      <div className="card flex items-center gap-4 px-5 py-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold-strong">
          <RotateCcw className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{dict["time.resetIn"]}</p>
          <div className="leading-tight text-ink" suppressHydrationWarning>
            {now && reset ? <DurationUnits ms={reset.getTime() - now.getTime()} dict={dict} /> : <span className="text-2xl font-black">--:--:--</span>}
          </div>
          <p className="text-xs font-semibold text-ink-faint">
            {dict["time.resetAt"]} {pad2(resetHourUtc)}:00 UTC
          </p>
        </div>
      </div>
    </div>
  );
}
