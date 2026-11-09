// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { useActionState } from "react";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { savePrepSchedule } from "@/lib/admin/prep-actions";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { BUFF_DAYS, type BuffDay, type Ministry, MINISTRIES, type PrepSchedule, TEMPLATE_SCHEDULE, TRAINING_DAY } from "@/lib/kvk/prep";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/** Each ministry's field: its words and its guided-tour marker (the tour test reads `tour:` from this list). */
const MINISTRY_FIELDS: Record<Ministry, { label: string; hint: string; tour: string }> = {
  construction: { label: "Construction buff", hint: "Truegold, Tempered Truegold and construction speedups get their ✅ on this day.", tour: "prep-construction" },
  research: { label: "Research buff", hint: "Truegold Dust and research speedups, and the War Academy tip, follow this day.", tour: "prep-research" },
};

/**
 * One round's buff days: a dropdown per ministry (Day 1, 2 or 5, with the
 * date), Save. Submits inside a transition so the dropdowns keep the saved
 * values on screen (React's own reset would show the old ones).
 */
export function PrepScheduleForm({
  roundKey,
  title,
  dates,
  trainingDate,
  schedule,
  set,
  locale,
}: {
  roundKey: string;
  title: string;
  /** The weekday and date of each buff day in this round, UTC. */
  dates: Record<BuffDay, string>;
  /** The date of Day 4, the training day the game fixes. */
  trainingDate: string;
  schedule: PrepSchedule;
  /** The council saved this round; otherwise it follows the template. */
  set: boolean;
  locale: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePrepSchedule, IDLE_STATE);
  const submit = useSubmitInTransition(formAction);
  return (
    <form action={formAction} onSubmit={submit} className="card space-y-4 p-5" data-tour="prep-round">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="round" value={roundKey} />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <span className={set ? "chip bg-success-soft text-success" : "chip bg-card-soft text-ink-muted"}>{set ? "Set by the council" : `Template: Day ${TEMPLATE_SCHEDULE.construction} / Day ${TEMPLATE_SCHEDULE.research}`}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MINISTRIES.map((ministry) => (
          <Field key={ministry} label={MINISTRY_FIELDS[ministry].label} htmlFor={`${roundKey}-${ministry}`} hint={MINISTRY_FIELDS[ministry].hint} error={state.errors?.[ministry]} tour={MINISTRY_FIELDS[ministry].tour}>
            <select id={`${roundKey}-${ministry}`} name={ministry} className="input select-chevron" defaultValue={String(schedule[ministry])}>
              {BUFF_DAYS.map((day) => (
                <option key={day} value={day}>
                  Day {day} · {dates[day]}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <Field label="Training buff" hint="Fixed by the game: trained troops score on Day 4 only. Shown on the players' card for completeness.">
          <p className="input flex items-center bg-card-soft text-ink-muted">
            Day {TRAINING_DAY} · {trainingDate}
          </p>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour="prep-save">
        <SubmitButton>Save</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
