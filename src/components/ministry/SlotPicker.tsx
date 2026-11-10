// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import { pickBlocks, SLOT_MINUTES, slotLabel } from "@/lib/ministry/ministry";
import { localTimeZone, MINUTE } from "@/lib/time";

/**
 * The times a player can take an appointment on one buff day: one button per
 * block of the day (`pickBlocks`: two hours each, or one per half-hour slot),
 * in UTC or, once the page runs in the browser, on the visitor's own clock.
 * The parent holds the picked half-hour slots; the form posts them.
 */

/** The picker's words: the player's page passes its language, the admin page English. */
export interface SlotPickerLabels {
  title: string;
  hint: string;
  utc: string;
  local: string;
  all: string;
  clear: string;
}

function localRange(dayStart: number, first: number, length: number, locale: string): string {
  try {
    // 24-hour clock in every language: "01:00 AM–03:00 AM" doesn't fit a button, and the UTC labels are 24-hour too.
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", numberingSystem: "latn" });
    const day = new Intl.DateTimeFormat(locale, { weekday: "short" });
    const start = new Date(dayStart + first * SLOT_MINUTES * MINUTE);
    const end = new Date(dayStart + (first + length) * SLOT_MINUTES * MINUTE);
    return `${day.format(start)} ${time.format(start)}–${time.format(end)}`;
  } catch {
    return slotLabel(first, length);
  }
}

export function SlotPicker({
  id,
  dayStart,
  picked,
  onChange,
  hydrated,
  error,
  labels,
  locale,
  tour,
}: {
  id: string;
  /** 00:00 UTC of the buff day, ms. */
  dayStart: number;
  picked: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
  /** The page runs in the browser: the visitor's own clock may be offered. */
  hydrated: boolean;
  error?: string | null;
  labels: SlotPickerLabels;
  locale: string;
  /** Its guided-tour marker. */
  tour?: string;
}) {
  const [zone, setZone] = useState<"utc" | "local">("utc");
  const blocks = pickBlocks();
  const local = hydrated && zone === "local";
  const toggle = (slots: readonly number[]) => {
    const next = new Set(picked);
    const on = slots.every((slot) => next.has(slot));
    for (const slot of slots) {
      if (on) next.delete(slot);
      else next.add(slot);
    }
    onChange(next);
  };
  return (
    <div className="space-y-3" data-tour={tour}>
      <div>
        <h4 id={`${id}-title`} className="text-base font-extrabold text-ink">
          {labels.title}
        </h4>
        <p className="text-sm font-semibold text-ink-muted">{labels.hint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {hydrated && (
          <div className="flex rounded-xl bg-card-soft p-1" role="group" aria-label={labels.title}>
            {(["utc", "local"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={zone === option}
                onClick={() => setZone(option)}
                className={clsx("rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors", zone === option ? "bg-card text-ink shadow-sm" : "text-ink-muted hover:text-ink")}
              >
                {option === "utc" ? labels.utc : labels.local}
              </button>
            ))}
          </div>
        )}
        {local && (
          <span className="text-xs font-semibold wrap-break-word text-ink-faint" dir="ltr">
            {localTimeZone()}
          </span>
        )}
        <span className="ms-auto flex flex-wrap gap-x-2 gap-y-3">
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(new Set(blocks.flat()))}>
            {labels.all}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange(new Set())} disabled={picked.size === 0}>
            {labels.clear}
          </button>
        </span>
      </div>
      <div className={clsx("grid gap-2", blocks.length > 24 ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")} role="group" aria-labelledby={`${id}-title`}>
        {blocks.map((slots) => {
          const on = slots.every((slot) => picked.has(slot));
          return (
            <button
              key={slots[0]}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(slots)}
              className={clsx(
                "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-sm font-extrabold tabular transition-colors",
                on ? "border-primary bg-primary-soft text-primary-strong" : "border-line bg-card text-ink-muted hover:border-primary/50 hover:text-ink",
              )}
            >
              {on && <Check className="size-4 shrink-0" aria-hidden />}
              <span dir="ltr" className="wrap-break-word">
                {local ? localRange(dayStart, slots[0], slots.length, locale) : slotLabel(slots[0], slots.length)}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
