// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { BadgeCheck } from "lucide-react";
import { useActionState, useState } from "react";
import { SlotPicker, type SlotPickerLabels } from "@/components/ministry/SlotPicker";
import { useNow } from "@/components/time/useNow";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { removeMinistryEntry, saveMinistryEntry, saveMinistryRound, setMinistryEntryDisabled } from "@/lib/admin/ministry-actions";
import type { AdminSignup } from "@/lib/admin/ministry-data";
import { BUFF_NAME, sectionName } from "@/lib/admin/ministry-labels";
import type { ScoringDay } from "@/lib/kvk/prep";
import { FIELD } from "@/lib/ministry/form";
import { BUFF_FIELDS, type ResourceField, scoredInPoints, type Section, slotLabel, slotRuns, speedupLabel, splitSpeedup } from "@/lib/ministry/ministry";
import { NO_ALLIANCE } from "@/lib/retro/form";
import { DateTimeField } from "./DateTimeField";
import { SubmitButton } from "./SubmitButton";
import { EmptyRow, Field, Notice } from "./ui";

/** The moderators' side of the ministry sign-ups: a round's switch and deadlines, and its entries. */

const RESOURCE_NAME: Record<ResourceField, string> = { truegold: "Truegold", temperedTruegold: "Tempered Truegold", tgDust: "Truegold Dust" };
const PICKER: SlotPickerLabels = {
  title: "Times the player can take",
  hint: "UTC. The appointment is assigned inside one of them.",
  utc: "UTC",
  local: "My time",
  all: "All day",
  clear: "Clear",
};

/** A buff day as the page hands it to the forms: plain values. */
export interface AdminSection extends Section {
  /** "Mon 30 Nov", UTC. */
  date: string;
  /** 00:00 UTC of the day, ms. */
  start: number;
  /** The deadline in force, as the date-time field takes it (UTC, `YYYY-MM-DDTHH:mm`). */
  deadline: string;
  /** The default deadline, for the hint. */
  defaultDeadline: string;
}

const number = (n: number) => new Intl.NumberFormat("en-GB").format(n);

/** "182.4M" for a power figure. */
function powerLabel(power: number | null): string | null {
  if (power === null) return null;
  return power >= 1_000_000 ? `${(power / 1_000_000).toFixed(1)}M` : number(power);
}

export function RoundForm({ roundKey, title, open, sections, locale }: { roundKey: string; title: string; open: boolean; sections: AdminSection[]; locale: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveMinistryRound, IDLE_STATE);
  const submit = useSubmitInTransition(formAction);
  return (
    <form action={formAction} onSubmit={submit} className="card space-y-4 p-5" data-tour="ministry-admin-round">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="round" value={roundKey} />
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold text-ink">{title}</h2>
        <span className={open ? "chip bg-success-soft text-success" : "chip bg-card-soft text-ink-muted"}>{open ? "Sign-ups open" : "Sign-ups closed"}</span>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-bold text-ink" data-tour="ministry-admin-open">
        <input type="checkbox" name="open" defaultChecked={open} className="size-5 accent-(--primary)" />
        Players can sign up for this round
      </label>
      <p className="text-xs text-ink-faint">Only one round is open at a time: opening this one closes the other, which keeps its entries and deadlines.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-tour="ministry-admin-deadlines">
        {sections.map((section) => (
          <DateTimeField
            key={section.day}
            id={`${roundKey}-deadline-${section.day}`}
            name={`deadline.${section.day}`}
            label={`${sectionName(section)} · Day ${section.day} (${section.date}): deadline, UTC`}
            defaultValue={section.deadline}
            hint={`Default: ${section.defaultDeadline} UTC, a day before the day starts. Not later than 00:00 UTC of the day.`}
            error={state.errors?.[`deadline.${section.day}`]}
            allowPast
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <SubmitButton>Save</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

export interface RankedRow {
  signup: AdminSignup;
  score: number;
}

/** One buff day's players, highest score first, each with what a moderator can do to the entry. */
export function SignupList({
  rows,
  section,
  sections,
  roundKey,
  alliances,
  locale,
}: {
  rows: RankedRow[];
  section: AdminSection;
  sections: AdminSection[];
  roundKey: string;
  alliances: Array<{ tag: string; name: string }>;
  locale: string;
}) {
  if (rows.length === 0) return <EmptyRow>Nobody has signed up for this day yet.</EmptyRow>;
  return (
    <ol className="divide-y divide-line">
      {rows.map((row, index) => (
        <SignupRow key={row.signup.id} rank={index + 1} row={row} section={section} sections={sections} roundKey={roundKey} alliances={alliances} locale={locale} />
      ))}
    </ol>
  );
}

/** The entries a moderator set aside: kept, left out of every list. */
export function DisabledList({ signups, sections, roundKey, alliances, locale }: { signups: AdminSignup[]; sections: AdminSection[]; roundKey: string; alliances: Array<{ tag: string; name: string }>; locale: string }) {
  return (
    <ul className="divide-y divide-line">
      {signups.map((signup) => (
        <SignupRow key={signup.id} row={{ signup, score: 0 }} sections={sections} roundKey={roundKey} alliances={alliances} locale={locale} />
      ))}
    </ul>
  );
}

function SignupRow({
  rank,
  row,
  section,
  sections,
  roundKey,
  alliances,
  locale,
}: {
  rank?: number;
  row: RankedRow;
  /** The day this list ranks; none in the list of entries set aside. */
  section?: AdminSection;
  sections: AdminSection[];
  roundKey: string;
  alliances: Array<{ tag: string; name: string }>;
  locale: string;
}) {
  const { signup, score } = row;
  const [editing, setEditing] = useState(false);
  const [disableState, disableAction, disabling] = useActionState<ActionState, FormData>(setMinistryEntryDisabled, IDLE_STATE);
  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(removeMinistryEntry, IDLE_STATE);
  const power = powerLabel(signup.power);
  const shown = section ? [section] : sections.filter((entry) => (signup.slots[entry.day]?.length ?? 0) > 0);
  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {rank !== undefined && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-black text-primary-strong tabular" aria-label={`Rank ${rank}`}>
            {rank}
          </span>
        )}
        <span className="text-base font-extrabold wrap-break-word text-ink" dir="auto">
          {signup.allianceTag ? `[${signup.allianceTag}] ` : ""}
          {signup.gameName}
        </span>
        {signup.verified && (
          <span className="chip bg-success-soft text-success">
            <BadgeCheck className="size-3.5" aria-hidden /> MightPulse
          </span>
        )}
        <span className="chip bg-card-soft text-ink-muted">ID {signup.governorId}</span>
        {power && <span className="chip bg-card-soft text-ink-muted">Power {power}</span>}
        {section && <span className="chip bg-gold-soft text-gold-ink">{scoredInPoints(section) ? `${number(score)} points` : `${speedupLabel(signup.amounts.trainingMinutes)} of speedups`}</span>}
        {signup.disabled && <span className="chip bg-gold-soft text-gold-ink">Set aside</span>}
        {!signup.ownedByBrowser && <span className="chip bg-card-soft text-ink-muted">Added by a moderator</span>}
      </div>
      {shown.map((entry) => (
        <p key={entry.day} className="text-sm text-ink-muted">
          {!section && <span className="font-bold text-ink">{sectionName(entry)}: </span>}
          {entry.buffs
            .flatMap((buff) => [
              ...BUFF_FIELDS[buff].resources.map((resource) => `${RESOURCE_NAME[resource]} ${number(signup.amounts[resource])}`),
              `${BUFF_NAME[buff]} speedups ${speedupLabel(signup.amounts[BUFF_FIELDS[buff].speedups])}`,
            ])
            .join(" · ")}
          <span className="block tabular">
            Can take:{" "}
            {slotRuns(signup.slots[entry.day] ?? [])
              .map(([first, length]) => slotLabel(first, length))
              .join(", ")}{" "}
            UTC
          </span>
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour="ministry-admin-actions">
        <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing((open) => !open)} aria-expanded={editing}>
          {editing ? "Close" : "Edit"}
        </button>
        <form action={disableAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={signup.id} />
          <input type="hidden" name="disabled" value={signup.disabled ? "0" : "1"} />
          <button type="submit" className="btn-ghost btn-sm" disabled={disabling}>
            {signup.disabled ? "Put back" : "Set aside"}
          </button>
        </form>
        <form
          action={removeAction}
          onSubmit={(event) => {
            if (!window.confirm(`Remove the sign-up of ${signup.gameName}?`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={signup.id} />
          <button type="submit" className="btn-ghost btn-sm text-danger" disabled={removing}>
            Remove
          </button>
        </form>
      </div>
      <Notice state={disableState} />
      <Notice state={removeState} />
      {editing && (
        <div className="rounded-xl border border-line p-4">
          <EntryForm roundKey={roundKey} sections={sections} alliances={alliances} locale={locale} entry={signup} />
        </div>
      )}
    </li>
  );
}

/** Add a sign-up by hand (no `entry`), or change one: the same fields the player's form posts. */
export function EntryForm({ roundKey, sections, alliances, locale, entry }: { roundKey: string; sections: AdminSection[]; alliances: Array<{ tag: string; name: string }>; locale: string; entry?: AdminSignup }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveMinistryEntry, IDLE_STATE);
  const submit = useSubmitInTransition(formAction);
  const hydrated = useNow(60_000) !== null;
  const [joined, setJoined] = useState<ReadonlySet<ScoringDay>>(() => new Set(sections.filter((section) => (entry?.slots[section.day]?.length ?? 0) > 0).map((section) => section.day)));
  const [slots, setSlots] = useState<Partial<Record<ScoringDay, ReadonlySet<number>>>>(() => Object.fromEntries(sections.map((section) => [section.day, new Set(entry?.slots[section.day] ?? [])])));
  const errors = state.errors ?? {};
  const key = entry?.id ?? "new";
  const show = (n: number | undefined) => (n && n > 0 ? String(n) : "");
  const knownTag = entry?.allianceTag && alliances.some((a) => a.tag === entry.allianceTag) ? entry.allianceTag : null;
  return (
    <form action={formAction} onSubmit={submit} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name={FIELD.round} value={roundKey} />
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Governor ID" htmlFor={`m-gov-${key}`} error={errors[FIELD.governorId]} hint={entry ? "Fixed: remove the entry to sign up another ID." : "Digits only. Any number works for a test entry."} tour={entry ? undefined : "ministry-admin-governor"}>
          <input id={`m-gov-${key}`} name={FIELD.governorId} className={clsx("input", entry && "text-ink-muted")} inputMode="numeric" dir="ltr" autoComplete="off" defaultValue={entry?.governorId} readOnly={Boolean(entry)} required />
        </Field>
        <Field label="In-game name" htmlFor={`m-name-${key}`} error={errors[FIELD.gameName]}>
          <input id={`m-name-${key}`} name={FIELD.gameName} className="input" dir="auto" autoComplete="off" maxLength={40} defaultValue={entry?.gameName} required />
        </Field>
        <Field label="Alliance" htmlFor={`m-alliance-${key}`} error={errors[FIELD.alliance]}>
          <select id={`m-alliance-${key}`} name={FIELD.alliance} className="input select-chevron" defaultValue={entry ? (knownTag ?? NO_ALLIANCE) : ""} required>
            <option value="" disabled>
              Choose…
            </option>
            {alliances.map((a) => (
              <option key={a.tag} value={a.tag}>
                [{a.tag}] {a.name}
              </option>
            ))}
            <option value={NO_ALLIANCE}>Other / no alliance</option>
          </select>
        </Field>
      </div>
      {sections.map((section) => {
        const on = joined.has(section.day);
        const picked = slots[section.day] ?? new Set<number>();
        const id = `m-${key}-${section.day}`;
        return (
          <fieldset key={section.day} className="space-y-3 rounded-xl bg-card-soft p-4" data-tour={entry ? undefined : "ministry-admin-day"}>
            <legend className="sr-only">{sectionName(section)}</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm font-extrabold text-ink">
              <input
                type="checkbox"
                name={FIELD.join(section.day)}
                checked={on}
                onChange={(event) =>
                  setJoined((previous) => {
                    const next = new Set(previous);
                    if (event.target.checked) next.add(section.day);
                    else next.delete(section.day);
                    return next;
                  })
                }
                className="size-5 accent-(--primary)"
              />
              {sectionName(section)} · Day {section.day} ({section.date})
            </label>
            {errors[FIELD.join(section.day)] && <p className="text-xs font-bold text-danger">{errors[FIELD.join(section.day)]}</p>}
            {on && (
              <>
                {picked.size > 0 && <input type="hidden" name={FIELD.slots(section.day)} value={[...picked].sort((a, b) => a - b).join(",")} />}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {section.buffs.flatMap((buff) => {
                    const speedup = splitSpeedup(entry?.amounts[BUFF_FIELDS[buff].speedups] ?? 0);
                    return [
                      ...BUFF_FIELDS[buff].resources.map((resource) => (
                        <Field key={resource} label={RESOURCE_NAME[resource]} htmlFor={`${id}-${resource}`} error={errors[resource]}>
                          <input id={`${id}-${resource}`} name={resource} className="input" inputMode="numeric" dir="ltr" autoComplete="off" placeholder="0" defaultValue={show(entry?.amounts[resource])} />
                        </Field>
                      )),
                      <Field key={`${buff}-days`} label={`${BUFF_NAME[buff]} speedups: days`} htmlFor={`${id}-${buff}-days`} error={errors[FIELD.days(buff)]}>
                        <input id={`${id}-${buff}-days`} name={FIELD.days(buff)} className="input" inputMode="numeric" dir="ltr" autoComplete="off" placeholder="0" defaultValue={show(speedup.days)} />
                      </Field>,
                      <Field key={`${buff}-hours`} label="… and hours" htmlFor={`${id}-${buff}-hours`} error={errors[FIELD.hours(buff)]}>
                        <input id={`${id}-${buff}-hours`} name={FIELD.hours(buff)} className="input" inputMode="numeric" dir="ltr" autoComplete="off" placeholder="0" defaultValue={show(speedup.hours)} />
                      </Field>,
                    ];
                  })}
                </div>
                <SlotPicker
                  id={id}
                  dayStart={section.start}
                  picked={picked}
                  onChange={(next) => setSlots((previous) => ({ ...previous, [section.day]: next }))}
                  hydrated={hydrated}
                  error={errors[FIELD.slots(section.day)]}
                  labels={PICKER}
                  locale="en-GB"
                />
              </>
            )}
          </fieldset>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          {pending ? "Saving…" : entry ? "Save" : "Add to the list"}
        </button>
        <Notice state={state} />
      </div>
    </form>
  );
}
