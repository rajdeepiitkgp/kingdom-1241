// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { BadgeCheck, Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useActionState, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { SlotPicker, type SlotPickerLabels } from "@/components/ministry/SlotPicker";
import { useNow } from "@/components/time/useNow";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { assignMinistryDay, type EntryLookup, lookupMinistryEntryGovernor, placeMinistryEntry, shiftMinistryEntry, removeAllMinistryEntries, removeMinistryEntry, saveMinistryEntry, saveMinistryRound, setMinistryEntryDisabled } from "@/lib/admin/ministry-actions";
import type { AdminSignup } from "@/lib/admin/ministry-data";
import { BUFF_NAME, RESOURCE_NAME, sectionName } from "@/lib/admin/ministry-labels";
import type { ScoringDay } from "@/lib/kvk/prep";
import type { AppointmentSource } from "@/lib/ministry/assign";
import { FIELD } from "@/lib/ministry/form";
import { type Amounts, BUFF_FIELDS, NO_AMOUNTS, parseAmounts, scoredInPoints, type Section, sectionScore, slotLabel, slotRuns, SLOTS_PER_DAY, speedupLabel, speedupMinutes, splitSpeedup } from "@/lib/ministry/ministry";
import { isGovernorId, NO_ALLIANCE, normalizeGovernorId } from "@/lib/retro/form";
import { DateTimeField } from "./DateTimeField";
import { SubmitButton } from "./SubmitButton";
import { EmptyRow, Field, Notice } from "./ui";

/** The moderators' side of the ministry sign-ups: a round's switch and deadlines, and its entries. */

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
      {editing && (
        <div className="rounded-xl border border-line p-4">
          <EntryForm roundKey={roundKey} sections={sections} alliances={alliances} locale={locale} entry={signup} />
        </div>
      )}
    </li>
  );
}

/**
 * Moves one player by hand: pick the player, then any free time (their own times are marked) or none.
 * One form for the whole day, so the list below stays short however many players sign up.
 */
function MoveForm({ placement, players, locale }: { placement: Placement; players: RosterPlayer[]; locale: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(placeMinistryEntry, IDLE_STATE);
  const submit = useSubmitInTransition(formAction);
  const [id, setId] = useState("");
  const player = players.find((entry) => entry.id === id);
  const held = player ? placement.held[player.id] : undefined;
  const own = new Set(player?.own ?? []);
  return (
    <form action={formAction} onSubmit={submit} className="space-y-3 rounded-xl bg-card-soft p-4" data-tour="ministry-admin-place">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="day" value={placement.day} />
      <p className="text-sm font-extrabold text-ink">Move a player by hand</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Player" htmlFor="move-player">
          <select id="move-player" name="id" className="input select-chevron" value={id} onChange={(event) => setId(event.target.value)} required>
            <option value="" disabled>
              Choose…
            </option>
            {players.map((entry) => {
              const at = placement.held[entry.id];
              return (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {at ? slotLabel(at.slot) : "no appointment"}
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="New time (UTC)" htmlFor="move-slot" error={state.errors?.slot}>
          {/* Keyed on the player and their stored time: the dropdown opens on where they are now. */}
          <select key={`${id}:${held?.slot ?? "none"}`} id="move-slot" name="slot" className="input select-chevron tabular" defaultValue={held ? String(held.slot) : ""} disabled={!player}>
            <option value="">No appointment</option>
            {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
              const holder = placement.takenBy[slot];
              const taken = holder !== undefined && held?.slot !== slot;
              return (
                <option key={slot} value={slot} disabled={taken}>
                  {slotLabel(slot)}
                  {taken ? ` · ${holder}` : own.has(slot) ? " · picked by the player" : ""}
                </option>
              );
            })}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <SubmitButton className="btn-ghost btn-sm" disabled={!player}>
          Move
        </SubmitButton>
        <span className="text-xs font-semibold text-ink-faint">Any free time, also outside the times the player picked. Assign again keeps it.</span>
      </div>
      <Notice state={state} />
    </form>
  );
}

/** A player of the day's list, for the move form. */
export interface RosterPlayer {
  id: string;
  /** `[TAG] Name`. */
  name: string;
  /** The slots the player picked. */
  own: number[];
}

export interface RosterCell {
  name: string;
  source: AppointmentSource;
  /** What the player brings on this day: "Truegold 7,860 · Tempered Truegold 245 · Construction speedups 521 d". */
  brings: string;
  /** "45,598,800 points", or the speedups on the training day. */
  score: string;
  /** The sign-up, for the arrows (only with the stored roster). */
  id?: string;
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
  placement,
  players,
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
  /** With the stored roster: who holds what, and the day's players, for the move form. */
  placement?: Placement;
  players?: RosterPlayer[];
}) {
  const filled = cells.filter(Boolean).length;
  const free = cells.length - filled;
  // The arrows of every row share one answer line, shown above the table.
  const [shifted, setShifted] = useState<ActionState>(IDLE_STATE);
  const [shifting, startShift] = useTransition();
  const movable = mode === "assigned";
  const shift = (id: string, direction: "up" | "down") => {
    const data = new FormData();
    data.set("locale", locale);
    data.set("id", id);
    data.set("day", String(day));
    data.set("direction", direction);
    startShift(async () => setShifted(await shiftMinistryEntry(IDLE_STATE, data)));
  };
  const arrow = "inline-grid size-8 place-items-center rounded-lg text-ink-muted hover:bg-card-soft hover:text-ink disabled:opacity-30";
  const arrows = (id: string, name: string, slot: number) => (
    <>
      <button type="button" className={arrow} disabled={shifting || slot === 0} onClick={() => shift(id, "up")} aria-label={`Move ${name} half an hour earlier`} title="Half an hour earlier">
        <ChevronUp className="size-5" aria-hidden />
      </button>
      <button type="button" className={arrow} disabled={shifting || slot === cells.length - 1} onClick={() => shift(id, "down")} aria-label={`Move ${name} half an hour later`} title="Half an hour later">
        <ChevronDown className="size-5" aria-hidden />
      </button>
    </>
  );
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
          <p className="text-xs text-ink-faint">Blue: given out by the assignment. Gold: placed by hand, or a player took the free time. Red: free.</p>
          {movable && <Notice state={shifted} />}
          {/* The day from its first half-hour to its last, as it is published: UTC start and end, the player, and for moderators what they bring. */}
          <table className="w-full border-collapse text-sm" data-tour="ministry-admin-table">
            <thead>
              <tr className="border-b border-line text-xs font-extrabold text-ink-muted">
                <th scope="col" className="py-2 pe-3 text-start">
                  Time (UTC)
                </th>
                <th scope="col" className="py-2 pe-3 text-start">
                  Player
                </th>
                <th scope="col" className="hidden py-2 pe-3 text-start md:table-cell">
                  Brings
                </th>
                <th scope="col" className="hidden py-2 pe-3 text-end md:table-cell">
                  Score
                </th>
                {movable && (
                  <th scope="col" className="hidden py-2 text-end md:table-cell">
                    Move
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {cells.map((cell, slot) => (
                <tr key={slot} className={clsx("border-b border-line/60 align-top", !cell && "bg-danger-soft")}>
                  <td className="py-1.5 ps-2 pe-3 font-black whitespace-nowrap text-ink tabular">
                    <span dir="ltr">{slotLabel(slot)}</span>
                    {/* On a phone the arrows sit under the time, so the name keeps the width. */}
                    {movable && cell?.id && <span className="block md:hidden">{arrows(cell.id, cell.name, slot)}</span>}
                  </td>
                  {cell ? (
                    <>
                      {/* max-w-0 below md: the name takes what the time and the arrows leave and wraps inside it. On a phone the score alone stands under it; the amounts are in the ranking below. */}
                      <td className="w-full max-w-0 py-1.5 pe-3 md:w-auto md:max-w-none">
                        <span className="font-bold wrap-break-word text-ink" dir="auto">
                          {cell.name}
                        </span>
                        {SOURCE_NOTE[cell.source] && <span className="chip ms-2 bg-gold-soft whitespace-nowrap text-gold-ink">{SOURCE_NOTE[cell.source]}</span>}
                        <span className="block text-xs text-ink-muted md:hidden">{cell.score}</span>
                      </td>
                      <td className="hidden py-1.5 pe-3 text-ink-muted md:table-cell">{cell.brings}</td>
                      <td className="hidden py-1.5 pe-3 text-end font-bold whitespace-nowrap text-ink tabular md:table-cell">{cell.score}</td>
                      {movable && (
                        <td className="hidden py-1 pe-1 text-end whitespace-nowrap md:table-cell" data-tour="ministry-admin-arrows">
                          {cell.id && arrows(cell.id, cell.name, slot)}
                        </td>
                      )}
                    </>
                  ) : (
                    <td colSpan={4} className="py-1.5 pe-2 font-extrabold text-danger">
                      Free
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {unplaced.length > 0 && (
            <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink" dir="auto">
              {mode === "preview" ? "Would get no appointment" : "No appointment"} (every time they picked {mode === "preview" ? "would go" : "went"} to a higher score): {unplaced.join(", ")}.
              {mode === "assigned" && free > 0 ? " The Ministry page tells them so and to message a moderator in the game; move them into a free time with the form below." : ""}
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
      {mode === "assigned" && placement && players && players.length > 0 && <MoveForm placement={placement} players={players} locale={locale} />}
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

/** Administrators: removes every sign-up of the round. Two taps, and the button names how many go. */
export function ClearRound({ roundKey, count, locale }: { roundKey: string; count: number; locale: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(removeAllMinistryEntries, IDLE_STATE);
  const [armed, setArmed] = useState(false);
  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-3"
      onSubmit={(event) => {
        if (armed) {
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
      <button type="submit" className={clsx("btn-ghost btn-sm text-danger", armed && "border-danger")} disabled={pending || count === 0} data-tour="ministry-admin-clear">
        {pending ? "Removing…" : armed ? `Tap again to remove all ${count}` : `Remove all ${count} sign-ups`}
      </button>
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
  // A new entry: the typed Governor ID is looked up, and a player MightPulse knows fills in the name and alliance. Nothing is blocked.
  const nameInput = useRef<HTMLInputElement>(null);
  const allianceInput = useRef<HTMLSelectElement>(null);
  const [looked, setLooked] = useState<{ id: string; result: EntryLookup } | null>(null);
  const [looking, startLookup] = useTransition();
  const lookUp = (raw: string) => {
    const id = normalizeGovernorId(raw);
    if (entry || !isGovernorId(id) || looked?.id === id) return;
    startLookup(async () => {
      const result = await lookupMinistryEntryGovernor(id);
      setLooked({ id, result });
      if (result.status !== "found") return;
      if (nameInput.current) nameInput.current.value = result.name ?? "";
      if (allianceInput.current) allianceInput.current.value = result.allianceTag && alliances.some((a) => a.tag === result.allianceTag) ? result.allianceTag : NO_ALLIANCE;
    });
  };
  /** Another ID than the one the name came from: the name and alliance go, so they never stay with the wrong ID. */
  const idChanged = (raw: string) => {
    if (!looked || normalizeGovernorId(raw) === looked.id) return;
    if (looked.result.status === "found") {
      if (nameInput.current) nameInput.current.value = "";
      if (allianceInput.current) allianceInput.current.value = "";
    }
    setLooked(null);
  };
  const lookupNote = looking
    ? "Asking MightPulse…"
    : looked?.result.status === "found"
      ? `MightPulse: ${looked.result.allianceTag ? `[${looked.result.allianceTag}] ` : ""}${looked.result.name}. Name and alliance are filled in.`
      : looked?.result.status === "unknown"
        ? "MightPulse doesn't know this ID. Fine for a test entry; for a real player, check the number."
        : looked?.result.status === "elsewhere"
          ? "MightPulse has this ID in another kingdom. Check the number."
          : null;
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
        <Field label="Governor ID" htmlFor={`m-gov-${key}`} error={errors[FIELD.governorId]} hint={entry ? "Fixed: remove the entry to sign up another ID." : (lookupNote ?? "Digits only. A player's real ID fills in the name and alliance; any number works for a test entry.")} tour={entry ? undefined : "ministry-admin-governor"}>
          <input id={`m-gov-${key}`} name={FIELD.governorId} className={clsx("input", entry && "text-ink-muted")} inputMode="numeric" dir="ltr" autoComplete="off" defaultValue={entry?.governorId} readOnly={Boolean(entry)} required onBlur={(event) => lookUp(event.currentTarget.value)} onChange={(event) => idChanged(event.currentTarget.value)} />
        </Field>
        <Field label="In-game name" htmlFor={`m-name-${key}`} error={errors[FIELD.gameName]}>
          <input ref={nameInput} id={`m-name-${key}`} name={FIELD.gameName} className="input" dir="auto" autoComplete="off" maxLength={40} defaultValue={entry?.gameName} required />
        </Field>
        <Field label="Alliance" htmlFor={`m-alliance-${key}`} error={errors[FIELD.alliance]}>
          <select ref={allianceInput} id={`m-alliance-${key}`} name={FIELD.alliance} className="input select-chevron" defaultValue={entry ? (knownTag ?? NO_ALLIANCE) : ""} required>
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
