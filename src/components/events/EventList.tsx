"use client";

import clsx from "clsx";
import { BookOpen, CalendarClock, Repeat } from "lucide-react";
import Link from "next/link";
import type { GameEvent } from "@/lib/data/types";
import { nextOccurrence, type Occurrence } from "@/lib/events/occurrences";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { localePath } from "@/lib/i18n/paths";
import { formatLocalDateTime, formatUtcTime, MINUTE } from "@/lib/time";
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
  events: GameEvent[];
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
    .filter((o): o is Occurrence => o !== null)
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

function recurrenceLabel(event: GameEvent, dict: Dictionary): string {
  if (!event.repeatEveryDays) return dict["events.oneOff"];
  if (event.repeatEveryDays === 1) return dict["events.daily"];
  if (event.repeatEveryDays === 7) return dict["events.weekly"];
  return format(dict["events.everyNDays"], { n: event.repeatEveryDays });
}

function durationLabel(minutes: number, dict: Dictionary): string {
  if (minutes % (24 * 60) === 0) return `${minutes / (24 * 60)} ${dict["common.days"]}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${dict["common.hours"]}`;
  return `${minutes} ${dict["common.minutes"]}`;
}

export function EventCard({
  occurrence,
  now,
  dict,
  locale,
  compact,
}: {
  occurrence: Occurrence;
  now: Date;
  dict: Dictionary;
  locale: string;
  compact: boolean;
}) {
  const { event, start, end, status } = occurrence;
  const colors = eventColor(event.color);
  const live = status === "live";
  const countdownMs = live ? end.getTime() - now.getTime() : start.getTime() - now.getTime();
  const soon = !live && countdownMs < 60 * MINUTE;

  return (
    <article className={clsx("card flex gap-4 border-2 p-4", colors.ring, live && "ring-4 ring-success/30")}>
      <span className={clsx("grid size-14 shrink-0 place-items-center rounded-2xl text-3xl", colors.icon)} aria-hidden>
        {event.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg/tight font-extrabold text-ink" dir="auto">{pick(event.name, locale)}</h3>
          <span className="chip bg-primary-soft text-primary">{dict[`events.category.${event.category}`]}</span>
          {live && <span className="chip bg-success-soft text-success">● {dict["time.live"]}</span>}
        </div>

        {!compact && <p className="mt-1 text-sm text-ink-muted" dir="auto">{pick(event.summary, locale)}</p>}

        <dl className="mt-3 grid grid-cols-1 gap-1.5 text-sm">
          <div className="flex items-center gap-2 text-ink">
            <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
            <dt className="sr-only">{dict["events.next"]}</dt>
            <dd className="font-bold" suppressHydrationWarning>
              {formatLocalDateTime(start, locale)}
              <span className="ms-2 text-xs font-semibold whitespace-nowrap text-ink-faint" dir="ltr">
                ({formatUtcTime(start)})
              </span>
            </dd>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Repeat className="size-4 text-primary" aria-hidden />
              {recurrenceLabel(event, dict)}
            </span>
            <span>
              {dict["events.duration"]}: <span className="font-bold text-ink">{durationLabel(event.durationMinutes, dict)}</span>
            </span>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p
            className={clsx(
              "rounded-xl px-3 py-1.5 text-sm font-extrabold tabular",
              live ? "bg-success-soft text-success" : soon ? "bg-gold-soft text-gold-strong" : "bg-primary-soft text-primary",
            )}
            suppressHydrationWarning
          >
            {live ? dict["time.endsIn"] : dict["time.startsIn"]} {formatDuration(countdownMs, dict, true)}
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
