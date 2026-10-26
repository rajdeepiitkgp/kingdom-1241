"use client";

import clsx from "clsx";
import { CalendarClock } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { formatLocalDateTime, formatLocalTime, formatUtcRange, formatUtcTime } from "@/lib/time";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";

/** Local battle time with a live countdown (client only, like the event cards). */
export function BattleCountdown({ battleAt, battleEndAt, dict, locale }: { battleAt: string; battleEndAt: string | null; dict: Dictionary; locale: string }) {
  const now = useNow(1000);
  const start = new Date(battleAt);
  const ms = now ? start.getTime() - now.getTime() : null;
  const future = ms !== null && ms > 0;
  const end = battleEndAt ? new Date(battleEndAt) : null;
  const endMs = now && battleEndAt ? new Date(battleEndAt).getTime() - now.getTime() : null;
  // Without an end time the badge keeps saying "Battle day!" once the battle has started.
  const status = ms === null ? "pending" : future ? "upcoming" : endMs === null ? "day" : endMs > 0 ? "live" : "ended";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
      <CalendarClock className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{dict["kvk.battleAt"]}</p>
        <p className="font-extrabold text-ink" suppressHydrationWarning>
          {now ? formatLocalDateTime(start, locale) : "…"}
          {now && end && <> – {end.toDateString() === start.toDateString() ? formatLocalTime(end, locale) : formatLocalDateTime(end, locale)}</>}{" "}
          <span className="text-xs font-semibold whitespace-nowrap text-ink-faint" dir="ltr">
            ({end ? formatUtcRange(start, end) : formatUtcTime(start)})
          </span>
        </p>
      </div>
      <p
        className={clsx(
          "rounded-xl px-3 py-1.5 text-sm font-extrabold tabular",
          status === "upcoming" || status === "pending" ? "bg-card text-primary" : status === "ended" ? "bg-card text-ink-muted" : "bg-success-soft text-success",
        )}
        suppressHydrationWarning
      >
        {status === "pending" || ms === null
          ? "--:--:--"
          : status === "upcoming"
            ? `${dict["kvk.battleStartsIn"]} ${formatDuration(ms, dict, true)}`
            : status === "live"
              ? dict["kvk.battleLive"]
              : status === "ended"
                ? dict["kvk.battleEnded"]
                : dict["kvk.battleStarted"]}
      </p>
    </div>
  );
}
