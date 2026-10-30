"use client";

import clsx from "clsx";
import { BookOpen, CalendarClock, Repeat, Shield } from "lucide-react";
import Link from "next/link";
import { daysUntil, nextOccurrence, type Occurrence, roundWeekdays } from "@/lib/events/occurrences";
import type { EventView } from "@/lib/events/view";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { formatLocalDateTime, formatUtcDate, formatUtcTime, MINUTE } from "@/lib/time";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";
import { eventColor } from "./event-colors";

export function EventList({
  events,
  dict,
  locale,
  limit,
  compact = false,
}: {
  /** Mapped on the server with `eventView`: the visitor's language only. */
  events: EventView[];
  dict: Dictionary;
  locale: string;
  /** Show only the next N occurrences. */
  limit?: number;
  compact?: boolean;
}) {
  const now = useNow(1000);

  if (!now) {
    // Skeletons until the client clock is available.
    const count = Math.min(limit ?? events.length, Math.max(events.length, 1), 4);
    return (
      <ul className={clsx("grid grid-cols-1 gap-3", !compact && "md:grid-cols-2")}>
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="card h-28 animate-pulse bg-card-soft" aria-hidden />
        ))}
      </ul>
    );
  }

  const occurrences = events
    .map((event) => nextOccurrence(event, now))
    .filter((o): o is Occurrence<EventView> => o !== null)
    .sort((a, b) => {
      if (a.status === "live" && b.status !== "live") return -1;
      if (b.status === "live" && a.status !== "live") return 1;
      return a.start.getTime() - b.start.getTime();
    })
    .slice(0, limit);

  if (occurrences.length === 0) {
    return <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["events.noEvents"]}</p>;
  }

  return (
    <ul className={clsx("grid grid-cols-1 gap-3", !compact && "md:grid-cols-2")}>
      {occurrences.map((occurrence) => (
        <li key={occurrence.event.id}>
          <EventCard occurrence={occurrence} now={now} dict={dict} locale={locale} compact={compact} />
        </li>
      ))}
    </ul>
  );
}

function recurrenceLabel(event: EventView, dict: Dictionary, locale: string): string {
  if (!event.repeatEveryDays) return dict["events.oneOff"];
  const every =
    event.repeatEveryDays === 1
      ? dict["events.daily"]
      : event.repeatEveryDays === 7
        ? dict["events.weekly"]
        : format(dict["events.everyNDays"], { n: event.repeatEveryDays });
  const days = roundWeekdays(event, locale);
  return days ? `${every} · ${days}` : every;
}

/** "Tomorrow", "In 3 days" in the visitor's language (the dictionary's words where the browser lacks `Intl.RelativeTimeFormat`). */
function relativeDay(days: number, dict: Dictionary, locale: string): string {
  if (days <= 0) return dict["events.today"];
  try {
    const text = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  } catch {
    return format(dict["events.inDays"], { n: days });
  }
}

function durationLabel(minutes: number, dict: Dictionary): string {
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} ${dict[minutes === 24 * 60 ? "common.day" : "common.days"]}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${dict["common.hours"]}`;
  return `${minutes} ${dict["common.minutes"]}`;
}

function EventCard({
  occurrence,
  now,
  dict,
  locale,
  compact,
}: {
  occurrence: Occurrence<EventView>;
  now: Date;
  dict: Dictionary;
  locale: string;
  compact: boolean;
}) {
  const { event, start, end, status } = occurrence;
  const colors = eventColor(event.color);
  const live = status === "live";
  // An event each alliance times itself is a game day (UTC): it counts in days, without a clock time.
  const byAlliance = event.timing === "alliance";
  const countdownMs = live ? end.getTime() - now.getTime() : start.getTime() - now.getTime();
  const days = daysUntil(start, now);
  const soon = !live && (byAlliance ? days <= 1 : countdownMs < 60 * MINUTE);

  return (
    <article className={clsx("card flex gap-4 border-2 p-4", colors.ring, live && !byAlliance && "ring-4 ring-success/30")}>
      <span className={clsx("grid size-14 shrink-0 place-items-center rounded-2xl text-3xl", colors.icon)} aria-hidden>
        {event.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg/tight font-extrabold text-ink" dir="auto">{event.name}</h3>
          <span className="chip bg-primary-soft text-primary">{dict[`events.category.${event.category}`]}</span>
          {live && !byAlliance && <span className="chip bg-success-soft text-success">● {dict["time.live"]}</span>}
        </div>

        {!compact && <p className="mt-1 text-sm text-ink-muted" dir="auto">{event.summary}</p>}

        <div className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
          <p className="flex items-center gap-2 text-ink">
            <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="sr-only">{dict["events.next"]}</span>
            <span className="font-bold" suppressHydrationWarning>
              {byAlliance ? formatUtcDate(start, locale) : formatLocalDateTime(start, locale)}
              <span className="ms-2 text-xs font-semibold whitespace-nowrap text-ink-faint" dir="ltr">
                ({byAlliance ? "UTC" : formatUtcTime(start)})
              </span>
            </span>
          </p>
          {byAlliance && (
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Shield className="size-4 shrink-0 text-primary" aria-hidden />
              {dict["events.allianceTimes"]}
            </p>
          )}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Repeat className="size-4 text-primary" aria-hidden />
              {recurrenceLabel(event, dict, locale)}
            </span>
            <span>
              {dict["events.duration"]}: <span className="font-bold text-ink">{durationLabel(event.durationMinutes, dict)}</span>
            </span>
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p
            className={clsx(
              "rounded-xl px-3 py-1.5 text-sm font-extrabold tabular",
              live ? "bg-success-soft text-success" : soon ? "bg-gold-soft text-gold-strong" : "bg-primary-soft text-primary",
            )}
            suppressHydrationWarning
          >
            {byAlliance
              ? relativeDay(live ? 0 : days, dict, locale)
              : `${live ? dict["time.endsIn"] : dict["time.startsIn"]} ${formatDuration(countdownMs, dict, true)}`}
          </p>
          {event.guideSlug && (
            <Link href={localePath(locale, `/guides/${event.guideSlug}`)} className="btn-ghost btn-sm">
              <BookOpen className="size-4" aria-hidden />
              {dict["events.openGuide"]}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
