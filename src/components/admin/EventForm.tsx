"use client";

import clsx from "clsx";
import { useState } from "react";
import { saveEvent } from "@/lib/admin/events-actions";
import type { AdminEvent } from "@/lib/admin/events-data";
import { DURATION_UNITS, EVENT_NAME_MAX, EVENT_SUMMARY_MAX, eventFormValues } from "@/lib/admin/site-forms";
import type { EventTiming } from "@/lib/data/types";
import { EVENT_CATEGORIES, EVENT_COLOR_KEYS } from "@/lib/events/options";
import { pick } from "@/lib/i18n/localized";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useEditorForm } from "./useEditorForm";

const CATEGORY_LABELS: Record<string, string> = { alliance: "Alliance", kingdom: "Kingdom", "cross-kingdom": "Cross-kingdom", solo: "Solo" };

const TIMINGS: Array<{ value: EventTiming; title: string; text: string }> = [
  { value: "fixed", title: "Same time for everyone", text: "Players see the start in their own time zone, with a countdown." },
  {
    value: "alliance",
    title: "Each alliance picks its times",
    text: "Players see the day only. Each alliance writes its times in its section of the event's guide.",
  },
];

/** An event in English: what it is, which guide explains it, and when it runs. */
export function EventForm({ event, guides, locale }: { event: AdminEvent | null; guides: Array<{ slug: string; title: string }>; locale: string }) {
  const { state, action, submit, errors } = useEditorForm(saveEvent);
  const [timing, setTiming] = useState<EventTiming>(event?.timing ?? "fixed");
  const values = eventFormValues(event);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      {event && <input type="hidden" name="id" value={event.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_8rem]">
        <Field label="Name (English)" htmlFor="name" error={errors.name} tour="event-name">
          <input id="name" name="name" className="input" defaultValue={pick(event?.name, "en")} maxLength={EVENT_NAME_MAX} dir="ltr" />
        </Field>
        <Field label="Icon" htmlFor="icon" error={errors.icon} hint="One emoji.">
          <input id="icon" name="icon" className="input text-center text-xl" defaultValue={event?.icon ?? "📅"} maxLength={16} />
        </Field>
      </div>

      <Field label="Summary (English)" htmlFor="summary" error={errors.summary} tour="event-summary" hint="One or two sentences on the event's card: what players do and what it gives.">
        <textarea id="summary" name="summary" className="input min-h-20" defaultValue={pick(event?.summary, "en")} maxLength={EVENT_SUMMARY_MAX} dir="ltr" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Kind" htmlFor="category">
          <select id="category" name="category" className="input select-chevron" defaultValue={event?.category ?? "alliance"}>
            {EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Card colour" htmlFor="color">
          <select id="color" name="color" className="input select-chevron capitalize" defaultValue={event?.color ?? "sky"}>
            {EVENT_COLOR_KEYS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Guide" htmlFor="guideSlug" error={errors.guideSlug} tour="event-guide" hint="The card links to it.">
          <select id="guideSlug" name="guideSlug" className="input select-chevron" defaultValue={event?.guideSlug ?? ""}>
            <option value="">No guide</option>
            {guides.map((guide) => (
              <option key={guide.slug} value={guide.slug}>
                {guide.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset className="space-y-4 rounded-2xl bg-card-soft p-4">
        <legend className="sr-only">When it runs</legend>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-tour="event-timing" role="radiogroup" aria-label="Who sets the time">
          {TIMINGS.map((option) => (
            <label
              key={option.value}
              className={clsx(
                "flex cursor-pointer gap-3 rounded-xl border-2 bg-card p-3",
                timing === option.value ? "border-primary" : "border-line hover:border-primary/50",
              )}
            >
              <input
                type="radio"
                name="timing"
                value={option.value}
                checked={timing === option.value}
                onChange={() => setTiming(option.value)}
                className="mt-1 size-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-extrabold text-ink">{option.title}</span>
                <span className="block text-xs text-ink-muted">{option.text}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-tour="event-start">
          <Field
            label={timing === "alliance" ? "Day of a round (UTC)" : "Start of a round (UTC day)"}
            htmlFor="startDate"
            error={errors.startDate}
            hint="Any past or coming round; the site counts on from it."
          >
            <input id="startDate" name="startDate" type="date" className="input dark:scheme-dark" defaultValue={values.startDate} />
          </Field>
          {timing === "fixed" && (
            <Field label="Start time (UTC)" htmlFor="startTime" error={errors.startTime} hint="In-game time is UTC.">
              <input id="startTime" name="startTime" type="time" step={60} className="input dark:scheme-dark" defaultValue={values.startTime} />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-tour="event-repeat">
          <Field label="Duration of one round" htmlFor="durationValue" error={errors.durationValue} hint={timing === "alliance" ? "Of one hunt or battle." : undefined}>
            <div className="flex gap-2">
              <input id="durationValue" name="durationValue" type="number" min={1} className="input min-w-0 flex-1" defaultValue={values.durationValue} />
              <select name="durationUnit" aria-label="Unit" className="input w-auto select-chevron" defaultValue={values.durationUnit}>
                {DURATION_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Repeats every … days" htmlFor="repeatEveryDays" error={errors.repeatEveryDays} hint="Empty for a one-time event.">
            <input id="repeatEveryDays" name="repeatEveryDays" type="number" min={1} max={365} className="input" defaultValue={event?.repeatEveryDays ?? ""} />
          </Field>
          <Field
            label="Second day: … days later"
            htmlFor="alsoAfterDays"
            error={errors.alsoAfterDays}
            hint="Optional. Viking Vengeance: a Tuesday, then 2 for the Thursday."
          >
            <input id="alsoAfterDays" name="alsoAfterDays" type="number" min={1} className="input" defaultValue={event?.alsoAfterDays ?? ""} />
          </Field>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm font-bold text-ink" data-tour="event-published">
        <input key={`published-${String(event?.published ?? true)}`} type="checkbox" name="published" defaultChecked={event?.published ?? true} className="size-4" />
        Show on the events page and Home (untick to hide it)
      </label>

      <div className="flex flex-wrap items-center gap-3" data-tour="event-save">
        <SubmitButton>{event ? "Save event" : "Create event"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
