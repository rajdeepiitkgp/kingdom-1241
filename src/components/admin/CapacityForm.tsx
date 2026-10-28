// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Minus, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { type ActionState, IDLE_STATE } from "@/lib/admin/action-state";
import { saveRallyCapacity } from "@/lib/admin/settings-actions";
import {
  ACTIVE_BROWSER_MINUTES,
  BROWSER_BUDGET,
  type Capacity,
  CAPACITY_BOUNDS,
  CAPACITY_MODES,
  type CapacityField,
  capacityFieldName,
  capacityFixes,
  capacityTotals,
  type CapacityUsage,
  DEFAULT_CAPACITY,
  isEditable,
  parseCapacityForm,
  REALTIME_CONNECTIONS,
  sameCapacity,
} from "@/lib/rally-sync/capacity";
import type { RoomMode } from "@/lib/rally-sync/room";
import { Notice } from "./ui";

const MODE_NAMES: Record<RoomMode, string> = { rally: "Rally", garrison: "Garrison", counter: "Counter-rally" };
const MODE_HINTS: Record<RoomMode, string> = {
  rally: "Our attacks: the rally leaders and their coordinators.",
  garrison: "Our defence: a few coordinators, many defenders watching.",
  counter: "The counter alliance's launch order, often run by the coordinator alone.",
};
const MODE_BARS: Record<RoomMode, string> = { rally: "bg-primary", garrison: "bg-gold", counter: "bg-ink-faint" };
const FIELD_LABELS: Record<CapacityField, string> = { rooms: "Rooms open at once", leaders: "Leaders per room", browsers: "Browsers per room" };
const FIELD_NAMES: Record<CapacityField, string> = { rooms: "rooms", leaders: "leaders per room", browsers: "browsers per room" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The owner's Rally Sync limits: three numbers per type of room, and one
 * budget all three share (the most browsers the rooms could hold, if every
 * one were full, against Supabase's live connections). Every change shows the
 * new total at once; over the budget the numbers that feed it are outlined,
 * each single number that would fix it is offered as a button, and Save
 * waits until it fits.
 */
export function CapacityForm({ initial, usage, available, locale }: { initial: Capacity; usage: Record<RoomMode, CapacityUsage>; available: boolean; locale: string }) {
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, formAction, pending] = useActionState(async (previous: ActionState, formData: FormData) => {
    const result = await saveRallyCapacity(previous, formData);
    const sent = parseCapacityForm(formData);
    if (result.status === "saved" && sent.ok) setSaved(sent.value);
    return result;
  }, IDLE_STATE);

  const set = (mode: RoomMode, field: CapacityField, value: number) => setValues((v) => ({ ...v, [mode]: { ...v[mode], [field]: value } }));
  const totals = capacityTotals(values);
  const fixes = capacityFixes(values);
  const outOfRange = (mode: RoomMode, field: CapacityField) => {
    const [min, max] = CAPACITY_BOUNDS[mode][field];
    return values[mode][field] < min || values[mode][field] > max;
  };
  const anyOutOfRange = CAPACITY_MODES.some((mode) => (["rooms", "leaders", "browsers"] as const).some((field) => outOfRange(mode, field)));
  const dirty = !sameCapacity(values, saved);
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {!available && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">Rally Sync&apos;s database could not be read: the numbers below are the defaults, and saving waits until it can be.</p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-tour="settings-modes">
        {CAPACITY_MODES.map((mode) => (
          <div key={mode} className="card-soft min-w-0 space-y-3 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="flex items-center gap-2 text-base font-extrabold text-ink">
                <span className={clsx("size-3 shrink-0 rounded-full", MODE_BARS[mode])} aria-hidden />
                {MODE_NAMES[mode]}
              </h3>
              <span className="text-xs font-bold text-ink-muted tabular">up to {plural(totals.perMode[mode], "browser", "browsers")}</span>
            </div>
            <p className="text-xs text-ink-faint">{MODE_HINTS[mode]}</p>
            {(["rooms", "leaders", "browsers"] as const).map((field) =>
              isEditable(mode, field) ? (
                <Stepper
                  key={field}
                  mode={mode}
                  field={field}
                  value={values[mode][field]}
                  onChange={(value) => set(mode, field, value)}
                  outlined={totals.over > 0 && field !== "leaders"}
                  error={outOfRange(mode, field) ? `${CAPACITY_BOUNDS[mode][field][0]} to ${CAPACITY_BOUNDS[mode][field][1]}.` : errors[capacityFieldName(mode, field)]}
                />
              ) : (
                <p key={field} className="text-sm text-ink-muted">
                  <span className="font-bold text-ink">{FIELD_LABELS[field]}:</span> none. Defenders plan their sends on their own device.
                </p>
              ),
            )}
            <Usage mode={mode} usage={usage[mode]} limit={values[mode].rooms} />
          </div>
        ))}
      </div>

      <Budget values={values} onFix={set} fixes={fixes} />

      <p className="text-xs text-ink-faint">
        A browser counts while it has had its room on screen in the last {ACTIVE_BROWSER_MINUTES} minutes, so one that left frees its place. Lowering a number
        never closes a room or removes anyone; it only stops new ones until some close.
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour="settings-save">
        <button type="submit" className="btn-primary btn-sm" disabled={pending || !available || !dirty || totals.over > 0 || anyOutOfRange}>
          Save
        </button>
        {dirty && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setValues(saved)}>
            Undo changes
          </button>
        )}
        {!sameCapacity(values, DEFAULT_CAPACITY) && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setValues(DEFAULT_CAPACITY)}>
            Use the recommended numbers
          </button>
        )}
      </div>
      <Notice state={state} />
    </form>
  );
}

function Stepper({
  mode,
  field,
  value,
  onChange,
  outlined,
  error,
}: {
  mode: RoomMode;
  field: CapacityField;
  value: number;
  onChange: (value: number) => void;
  outlined: boolean;
  error?: string;
}) {
  const [min, max] = CAPACITY_BOUNDS[mode][field];
  const id = capacityFieldName(mode, field);
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-sm font-bold text-ink">
          {FIELD_LABELS[field]}
        </label>
        <div className={clsx("flex shrink-0 items-center gap-1 rounded-xl", outlined && "ring-2 ring-danger ring-offset-2 ring-offset-card-soft")} dir="ltr">
          <button
            type="button"
            className="btn-ghost btn-sm px-2.5"
            onClick={() => onChange(Math.min(max, Math.max(min, value - 1)))}
            disabled={value <= min}
            aria-label={`${MODE_NAMES[mode]}: one ${field === "rooms" ? "room" : field === "leaders" ? "leader" : "browser"} fewer`}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            id={id}
            name={id}
            className="input w-14 p-2 text-center"
            inputMode="numeric"
            autoComplete="off"
            value={String(value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
              onChange(digits === "" ? 0 : Number(digits));
            }}
            onBlur={() => onChange(Math.min(max, Math.max(min, value)))}
          />
          <button
            type="button"
            className="btn-ghost btn-sm px-2.5"
            onClick={() => onChange(Math.min(max, Math.max(min, value + 1)))}
            disabled={value >= max}
            aria-label={`${MODE_NAMES[mode]}: one ${field === "rooms" ? "room" : field === "leaders" ? "leader" : "browser"} more`}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-end text-xs font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** What is open right now, and a note when that is already more than the number set. */
function Usage({ mode, usage, limit }: { mode: RoomMode; usage: CapacityUsage; limit: number }) {
  const parts = [plural(usage.rooms, "room", "rooms"), plural(usage.browsers, "browser", "browsers")];
  if (mode !== "garrison") parts.push(plural(usage.leaders, "leader", "leaders"));
  return (
    <div className="border-t border-line pt-2 text-xs">
      <p className="font-semibold text-ink-muted tabular">Open now: {parts.join(" · ")}</p>
      {usage.rooms > limit && <p className="mt-1 font-bold text-danger">More are open than this allows. They stay open; a new one waits until some close.</p>}
    </div>
  );
}

/** The budget all three types share, as one bar split by type, and the single changes that would bring it back within. */
function Budget({ values, fixes, onFix }: { values: Capacity; fixes: ReturnType<typeof capacityFixes>; onFix: (mode: RoomMode, field: CapacityField, value: number) => void }) {
  const { perMode, total, over } = capacityTotals(values);
  const scale = Math.max(total, BROWSER_BUDGET);
  return (
    <div className={clsx("space-y-2 rounded-2xl border-2 p-4", over > 0 ? "border-danger bg-danger-soft" : "border-line")} data-tour="settings-total">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-extrabold text-ink">Browsers if every room were full</p>
        <p className={clsx("text-sm font-black tabular", over > 0 ? "text-danger" : "text-success")}>
          {total} / {BROWSER_BUDGET} {over > 0 ? `(${over} over)` : "✓"}
        </p>
      </div>
      <div className="relative flex h-3 overflow-hidden rounded-full bg-card-soft" role="img" aria-label={`${total} of ${BROWSER_BUDGET} browsers`}>
        {CAPACITY_MODES.map((mode) => (
          <div key={mode} className={MODE_BARS[mode]} style={{ width: `${(perMode[mode] / scale) * 100}%` }} />
        ))}
        {over > 0 && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ insetInlineStart: `${(BROWSER_BUDGET / scale) * 100}%` }} aria-hidden />}
      </div>
      <p className="text-xs text-ink-muted tabular">
        {CAPACITY_MODES.map((mode) => `${MODE_NAMES[mode]} ${perMode[mode]}`).join(" + ")} = {total}. Every browser in a room keeps one live connection, and
        Supabase&apos;s free plan allows {REALTIME_CONNECTIONS}: all rooms together may hold {BROWSER_BUDGET}, with {REALTIME_CONNECTIONS - BROWSER_BUDGET} to spare.
      </p>
      {over > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-sm font-bold text-danger">Lower one of the outlined numbers. Any one of these is enough:</p>
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {fixes.map((fix) => (
              <button key={`${fix.mode}-${fix.field}`} type="button" className="btn-ghost btn-sm" onClick={() => onFix(fix.mode, fix.field, fix.to)}>
                {MODE_NAMES[fix.mode]} {FIELD_NAMES[fix.field]}: {fix.from} → {fix.to}
              </button>
            ))}
          </div>
          {fixes.length === 0 && <p className="text-sm text-danger">No single number can do it: lower two of them.</p>}
        </div>
      )}
    </div>
  );
}
