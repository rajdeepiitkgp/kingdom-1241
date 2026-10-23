"use client";

import clsx from "clsx";
import { CalendarClock } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatLocalDateTime, formatUtcTime } from "@/lib/time";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";

/** Local battle time with a live countdown (client only, like the event cards). */
export function BattleCountdown({ battleAt, dict, locale }: { battleAt: string; dict: Dictionary; locale: string }) {
  const now = useNow(1000);
  const start = new Date(battleAt);
  const ms = now ? start.getTime() - now.getTime() : null;
  const future = ms !== null && ms > 0;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
      <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">{dict["kvk.battleAt"]}</p>
        <p className="font-extrabold text-ink" suppressHydrationWarning>
          {now ? formatLocalDateTime(start, locale) : "…"}{" "}
          <span className="whitespace-nowrap text-xs font-semibold text-ink-faint" dir="ltr">
            ({formatUtcTime(start)})
          </span>
        </p>
      </div>
      <p
        className={clsx("tabular rounded-xl px-3 py-1.5 text-sm font-extrabold", future ? "bg-card text-primary" : "bg-success-soft text-success")}
        suppressHydrationWarning
      >
        {ms === null ? "--:--:--" : future ? `${dict["kvk.battleStartsIn"]} ${formatDuration(ms, dict, true)}` : dict["kvk.battleStarted"]}
      </p>
    </div>
  );
}
