// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { BadgeCheck, Check, Copy } from "lucide-react";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { SlotPicker, type SlotPickerLabels } from "@/components/ministry/SlotPicker";
import { useNow } from "@/components/time/useNow";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { assignMinistryDay, placeMinistryEntry, removeMinistryEntry, saveMinistryEntry, saveMinistryRound, setMinistryEntryDisabled } from "@/lib/admin/ministry-actions";
import type { AdminSignup } from "@/lib/admin/ministry-data";
import { BUFF_NAME, sectionName } from "@/lib/admin/ministry-labels";
import type { ScoringDay } from "@/lib/kvk/prep";
import type { AppointmentSource } from "@/lib/ministry/assign";
import { FIELD } from "@/lib/ministry/form";
import { type Amounts, BUFF_FIELDS, NO_AMOUNTS, parseAmounts, type ResourceField, scoredInPoints, type Section, sectionScore, slotLabel, slotRuns, SLOTS_PER_DAY, speedupLabel, speedupMinutes, splitSpeedup } from "@/lib/ministry/ministry";
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

type RoundFormProps = { roundKey: string; title: string; open: boolean; sections: AdminSection[]; locale: string };

/** Everything a form would send, as one string: two of them differ when a field does. */
function formValues(form: HTMLFormElement): string {
  return JSON.stringify([...new FormData(form)].map(([name, value]) => [name, typeof value === "string" ? value : ""]));
}

// Which round's form was sent last. Saving one round changes the other (it closes it), so the other's
// "Saved … can sign up for this round now" would stay on the page saying something that is no longer true.
let lastSent: string | null = null;
const sentListeners = new Set<() => void>();
const watchSent = (listener: () => void) => {
  sentListeners.add(listener);
  return () => void sentListeners.delete(listener);
};
function markSent(roundKey: string) {
  lastSent = roundKey;
  for (const listener of sentListeners) listener();
}

/**
 * One round's switch and deadlines. Its fields are drawn again after every save and whenever the stored
 * values change (saving the other round closes this one), so they always show what is stored and Save
 * wakes up only once something differs from it.
 */
export function RoundForm(props: RoundFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveMinistryRound, IDLE_STATE);
  const [seen, setSeen] = useState(state);
  const [saves, setSaves] = useState(0);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "saved") setSaves(saves + 1);
  }
  const stored = `${props.open}|${props.sections.map((section) => section.deadline).join("|")}`;
  const newest = useSyncExternalStore(
    watchSent,
    () => lastSent === props.roundKey,
    () => false,
  );
  const send = (data: FormData) => {
    markSent(props.roundKey);
    formAction(data);
  };
  return <RoundFields key={`${saves}|${stored}`} {...props} state={newest ? state : IDLE_STATE} formAction={send} />;
}

function RoundFields({ roundKey, title, open, sections, locale, state, formAction }: RoundFormProps & { state: ActionState; formAction: (data: FormData) => void }) {
  const submit = useSubmitInTransition(formAction);
  const baseline = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);
  const remember = (form: HTMLFormElement | null) => {
    if (form && baseline.current === null) baseline.current = formValues(form);
  };
  const compare = (form: HTMLFormElement) => setChanged(formValues(form) !== baseline.current);
  return (
    <form ref={remember} action={formAction} onSubmit={submit} onInput={(event) => compare(event.currentTarget)} onClick={(event) => compare(event.currentTarget)} className="card space-y-4 p-5" data-tour="ministry-admin-round">
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
        <SubmitButton disabled={!changed}>Save</SubmitButton>
        {!changed && state.status !== "saved" && <span className="text-xs font-semibold text-ink-faint">Nothing to save yet: change the switch or a deadline first.</span>}
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
  placement,
}: {
  rows: RankedRow[];
  section: AdminSection;
  sections: AdminSection[];
  roundKey: string;
  alliances: Array<{ tag: string; name: string }>;
  locale: string;
  /** The day's appointments once they are given out: each row then shows the player's and lets a moderator change it. */
  placement?: Placement;
}) {
  if (rows.length === 0) return <EmptyRow>Nobody has signed up for this day yet.</EmptyRow>;
  return (
    <ol className="divide-y divide-line">
      {rows.map((row, index) => (
        <SignupRow key={row.signup.id} rank={index + 1} row={row} section={section} sections={sections} roundKey={roundKey} alliances={alliances} locale={locale} placement={placement} />
      ))}
    </ol>
  );
}

/** A day's appointments as the list needs them: who holds which slot. */
export interface Placement {
  day: ScoringDay;
  /** Per sign-up id. */
  held: Record<string, { slot: number; source: AppointmentSource }>;
  /** Per slot, the holder's name. */
  takenBy: Record<number, string>;
}

const SOURCE_NOTE: Record<AppointmentSource, string | null> = { auto: null, moderator: "placed by hand", late: "took a free time" };

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
  placement,
}: {
  rank?: number;
  row: RankedRow;
  /** The day this list ranks; none in the list of entries set aside. */
  section?: AdminSection;
  sections: AdminSection[];
  roundKey: string;
  alliances: Array<{ tag: string; name: string }>;
  locale: string;
  placement?: Placement;
}) {
  const { signup, score } = row;
  const held = placement?.held[signup.id];
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
        {placement &&
          (held ? (
            <span className="chip bg-primary-soft text-primary-strong tabular" data-tour="ministry-admin-appointment">
              {slotLabel(held.slot)} UTC{SOURCE_NOTE[held.source] ? ` · ${SOURCE_NOTE[held.source]}` : ""}
            </span>
          ) : (
            <span className="chip bg-danger-soft text-danger" data-tour="ministry-admin-appointment">
              No appointment
            </span>
          ))}
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
      {placement && !signup.disabled && <PlaceForm id={signup.id} placement={placement} own={signup.slots[placement.day] ?? []} locale={locale} />}
      {editing && (
        <div className="rounded-xl border border-line p-4">
          <EntryForm roundKey={roundKey} sections={sections} alliances={alliances} locale={locale} entry={signup} />
        </div>
      )}
    </li>
  );
}

/** A player's appointment, changed by hand: any free time (their own times are marked), or none. */
function PlaceForm({ id, placement, own, locale }: { id: string; placement: Placement; own: readonly number[]; locale: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(placeMinistryEntry, IDLE_STATE);
  const submit = useSubmitInTransition(formAction);
  const held = placement.held[id];
  const mine = new Set(own);
  return (
    <form action={formAction} onSubmit={submit} className="flex flex-wrap items-end gap-x-2 gap-y-3" data-tour="ministry-admin-place">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="day" value={placement.day} />
      <Field label="Appointment (UTC)" htmlFor={`place-${id}`} error={state.errors?.slot}>
        {/* Keyed on the stored appointment: a new run of the assignment may move the player, and the dropdown follows. */}
        <select key={held?.slot ?? "none"} id={`place-${id}`} name="slot" className="input select-chevron tabular" defaultValue={held ? String(held.slot) : ""}>
          <option value="">No appointment</option>
          {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
            const holder = placement.takenBy[slot];
            const taken = holder !== undefined && held?.slot !== slot;
            return (
              <option key={slot} value={slot} disabled={taken}>
                {slotLabel(slot)}
                {taken ? ` · ${holder}` : mine.has(slot) ? " · picked by the player" : ""}
              </option>
            );
          })}
        </select>
      </Field>
      <SubmitButton className="btn-ghost btn-sm">Place by hand</SubmitButton>
      <Notice state={state} />
    </form>
  );
}

export interface RosterCell {
  name: string;
  source: AppointmentSource;
}

/**
 * A buff day's roster for moderators. `preview`: sign-ups are still open, so this is how the appointments would be
 * given out right now (nothing is stored). Otherwise the stored roster, with the button that runs the assignment again.
 */
export function RosterPanel({
  roundKey,
  day,
  title,
  mode,
  deadline,
  cells,
  unplaced,
  chat,
  locale,
}: {
  roundKey: string;
  day: ScoringDay;
  /** "Construction · Mon 30 Nov". */
  title: string;
  mode: "preview" | "assigned" | "waiting";
  /** "Sun 29 Nov, 00:00" UTC. */
  deadline: string;
  /** The day's 48 appointments in order. */
  cells: Array<RosterCell | null>;
  /** Players on the day's list without an appointment. */
  unplaced: string[];
  chat: string;
  locale: string;
}) {
  const filled = cells.filter(Boolean).length;
  const free = cells.length - filled;
  return (
    <div className="space-y-3" data-tour="ministry-admin-roster">
      <p className="text-sm font-bold text-ink">
        {mode === "preview" && `Players can sign up until ${deadline} UTC; the appointments are then given out by themselves. If that were now: ${filled} of 48 filled.`}
        {mode === "assigned" && `${title}: ${filled} of the 48 appointments are filled${free > 0 ? `, ${free} are free (red). Players see the free ones on the Ministry page and are told to message a moderator in the game.` : "."}`}
        {mode === "waiting" && `The deadline (${deadline} UTC) has passed, but the appointments aren't given out yet: that happens by itself only while the round is open for players. Press the button to do it now.`}
      </p>
      {mode !== "waiting" && (
        <>
          <div className="grid grid-cols-48 gap-px overflow-hidden rounded-lg" role="img" aria-label={`${filled} of 48 appointments filled`}>
            {cells.map((cell, slot) => (
              <span key={slot} title={`${slotLabel(slot)} UTC: ${cell ? cell.name : "free"}`} className={clsx("h-6", cell ? (cell.source === "auto" ? "bg-primary" : "bg-gold") : "bg-danger")} />
            ))}
          </div>
          <p className="text-xs text-ink-faint">Blue: given out by the assignment. Gold: placed by hand, or a player took the free time. Red: free. Hover a cell for its time and player.</p>
          {filled > 0 && (
            <ol className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
              {cells.map((cell, slot) =>
                cell ? (
                  <li key={slot} className="flex min-w-0 gap-2">
                    <span className="shrink-0 font-bold text-ink tabular" dir="ltr">
                      {slotLabel(slot)}
                    </span>
                    <span className="min-w-0 wrap-break-word text-ink-muted" dir="auto">
                      {cell.name}
                      {SOURCE_NOTE[cell.source] ? ` (${SOURCE_NOTE[cell.source]})` : ""}
                    </span>
                  </li>
                ) : null,
              )}
            </ol>
          )}
          {unplaced.length > 0 && (
            <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink" dir="auto">
              {mode === "preview" ? "Would get no appointment" : "No appointment"} (every time they picked {mode === "preview" ? "would go" : "went"} to a higher score): {unplaced.join(", ")}.
              {mode === "assigned" && free > 0 ? " The Ministry page tells them so and to message a moderator in the game; place them by hand in a free time below." : ""}
            </p>
          )}
        </>
      )}
      {mode !== "preview" && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <AssignButton roundKey={roundKey} day={day} first={mode === "waiting"} locale={locale} />
          {mode === "assigned" && filled > 0 && <CopyText text={chat} label="Copy for game chat" />}
        </div>
      )}
    </div>
  );
}

/** Runs the day's assignment; a second tap within a few seconds confirms, since it moves players who were placed by it. */
function AssignButton({ roundKey, day, first, locale }: { roundKey: string; day: ScoringDay; first: boolean; locale: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(assignMinistryDay, IDLE_STATE);
  const [armed, setArmed] = useState(false);
  return (
    <form
      action={formAction}
      className="contents"
      onSubmit={(event) => {
        if (first || armed) {
          setArmed(false);
          return;
        }
        event.preventDefault();
        setArmed(true);
        window.setTimeout(() => setArmed(false), 4000);
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="round" value={roundKey} />
      <input type="hidden" name="day" value={day} />
      <button type="submit" className={clsx("btn-sm", armed ? "btn-primary" : "btn-ghost")} disabled={pending} data-tour="ministry-admin-assign">
        {pending ? "Assigning…" : first ? "Assign now" : armed ? "Tap again to assign anew" : "Assign again"}
      </button>
      {!first && !armed && state.status === "idle" && <span className="text-xs font-semibold text-ink-faint">Keeps players placed by hand and players who took a free time; places everyone else anew.</span>}
      <Notice state={state} />
    </form>
  );
}

/** Copies a text; where the browser has no clipboard or refuses, the text shows to copy by hand. */
function CopyText({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setBlocked(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setBlocked(true);
    }
  }
  return (
    <>
      <button type="button" className="btn-ghost btn-sm" onClick={() => void copy()}>
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied ? "Copied" : label}
      </button>
      {blocked && <p className="w-full rounded-lg bg-card-soft px-3 py-2 text-sm whitespace-pre-line text-ink select-all">{text}</p>}
    </>
  );
}

/** Add a sign-up by hand (no `entry`), or change one: the same fields the player's form posts. */
export function EntryForm({ roundKey, sections, alliances, locale, entry }: { roundKey: string; sections: AdminSection[]; alliances: Array<{ tag: string; name: string }>; locale: string; entry?: AdminSignup }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveMinistryEntry, IDLE_STATE);
  const submit = useSubmitInTransition(formAction);
  const hydrated = useNow(60_000) !== null;
  const [joined, setJoined] = useState<ReadonlySet<ScoringDay>>(() => new Set(sections.filter((section) => (entry?.slots[section.day]?.length ?? 0) > 0).map((section) => section.day)));
  const [slots, setSlots] = useState<Partial<Record<ScoringDay, ReadonlySet<number>>>>(() => Object.fromEntries(sections.map((section) => [section.day, new Set(entry?.slots[section.day] ?? [])])));
  // What is typed right now, so each day shows its score before the save (the server works it out again from the form).
  const [amounts, setAmounts] = useState<Amounts>(entry?.amounts ?? NO_AMOUNTS);
  const readAmounts = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const typed = (name: string) => Number(String(data.get(name) ?? "").trim() || 0);
    const minutes = (buff: keyof typeof BUFF_FIELDS) => speedupMinutes(typed(FIELD.days(buff)), typed(FIELD.hours(buff)));
    setAmounts(
      parseAmounts({
        truegold: typed("truegold"),
        temperedTruegold: typed("temperedTruegold"),
        tgDust: typed("tgDust"),
        constructionMinutes: minutes("construction"),
        researchMinutes: minutes("research"),
        trainingMinutes: minutes("training"),
      }),
    );
  };
  const errors = state.errors ?? {};
  const key = entry?.id ?? "new";
  const show = (n: number | undefined) => (n && n > 0 ? String(n) : "");
  const knownTag = entry?.allianceTag && alliances.some((a) => a.tag === entry.allianceTag) ? entry.allianceTag : null;
  return (
    <form action={formAction} onSubmit={submit} onInput={(event) => readAmounts(event.currentTarget)} className="space-y-4">
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
                <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm font-extrabold text-gold-ink" aria-live="polite">
                  {scoredInPoints(section) ? `Score on this day: ${number(sectionScore(section, amounts))} points` : `Ranked on this day by its speedups: ${speedupLabel(amounts.trainingMinutes)}`}
                </p>
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
