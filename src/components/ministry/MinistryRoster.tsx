// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { LoaderCircle, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import type { Buff, ScoringDay } from "@/lib/kvk/prep";
import { findMinistryAppointments, type FindState } from "@/lib/ministry/actions";
import { SLOT_MINUTES, slotClock } from "@/lib/ministry/ministry";
import { isGovernorId, normalizeGovernorId } from "@/lib/retro/form";
import { MINUTE } from "@/lib/time";
import { ItemIcon } from "../kvk/ItemIcon";
import { BUFF_ICON, BUFF_IMAGES } from "./icons";

/**
 * The published roster of the buff days whose appointments are given out: 48
 * half-hours per day, each with its player or marked free. Names only: a
 * Governor ID typed into "find" is looked up on the server, the list never
 * carries the IDs.
 */

export interface RosterDay {
  day: ScoringDay;
  buffs: Buff[];
  /** "Mon, 30 Nov", UTC. */
  date: string;
  /** 00:00 UTC of the day, ms. */
  start: number;
  /** The day's 48 appointments in order: `[TAG] Name`, or null for a free one. */
  cells: Array<string | null>;
}

/** A slot's start in the visitor's own time ("Mon 15:30"), or null where the browser can't say. */
function localStart(dayStart: number, slot: number, locale: string): string | null {
  try {
    const at = new Date(dayStart + slot * SLOT_MINUTES * MINUTE);
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", numberingSystem: "latn" });
    const day = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return `${day.format(at)} ${time.format(at)}`;
  } catch {
    return null;
  }
}

export function MinistryRoster({
  days,
  own,
  hydrated,
  dict,
  locale,
}: {
  days: RosterDay[];
  /** Per day, the slots of this browser's own entries. */
  own: Partial<Record<ScoringDay, number[]>>;
  /** The page runs in the browser: the visitor's own time may be shown. */
  hydrated: boolean;
  dict: Dictionary;
  locale: string;
}) {
  const [chosen, setChosen] = useState<ScoringDay | null>(null);
  const [query, setQuery] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [found, setFound] = useState<{ id: string; result: FindState } | null>(null);
  const [searching, startSearch] = useTransition();
  const shown = days.find((entry) => entry.day === chosen) ?? days[0];
  if (!shown) return null;

  const typed = query.trim();
  const asId = normalizeGovernorId(typed);
  const byId = /^\d[\d .\-_]*$/.test(typed) && isGovernorId(asId);
  const lookup = byId && found?.id === asId ? found.result : null;
  const needle = byId ? "" : typed.toLocaleLowerCase(locale);
  const idSlot = lookup?.status === "found" ? lookup.appointments?.[shown.day] : undefined;
  const mine = new Set(own[shown.day] ?? []);

  const find = () => {
    if (!byId || found?.id === asId) return;
    startSearch(async () => {
      const result = await findMinistryAppointments(asId);
      setFound({ id: asId, result });
    });
  };

  const matches = (name: string | null, slot: number): boolean => {
    if (byId) return typeof idSlot === "number" && idSlot === slot;
    return needle !== "" && name !== null && name.toLocaleLowerCase(locale).includes(needle);
  };
  const filled = shown.cells.filter(Boolean).length;
  const free = shown.cells.length - filled;
  const filtering = byId ? typeof idSlot === "number" : needle !== "";
  const rows = shown.cells.map((name, slot) => ({ name, slot })).filter(({ name, slot }) => (onlyFree ? name === null : !filtering || matches(name, slot)));
  const nothing = (byId && lookup !== null && lookup.status !== "skipped" && typeof idSlot !== "number") || (!byId && needle !== "" && rows.length === 0 && !onlyFree);

  return (
    <section className="card space-y-4 p-5" data-tour="ministry-roster">
      <div>
        <h2 className="text-lg font-extrabold text-ink">{dict["ministry.roster.title"]}</h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">{dict["ministry.roster.hint"]}</p>
      </div>

      {days.length > 1 && (
        <div className="flex flex-wrap gap-x-2 gap-y-3" role="group" aria-label={dict["ministry.roster.title"]}>
          {days.map((entry) => (
            <button key={entry.day} type="button" aria-pressed={entry.day === shown.day} className={clsx("btn-ghost btn-sm", entry.day === shown.day && "border-primary text-primary-strong")} onClick={() => setChosen(entry.day)}>
              {entry.buffs.map((buff) => dict[`prep.council.${buff}`]).join(" + ")} · {entry.date}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-3">
        <span className="flex shrink-0 items-center gap-1">
          {shown.buffs.map((buff) => (
            <ItemIcon key={buff} image={BUFF_IMAGES[buff]} emoji={BUFF_ICON[buff]} className="size-9" />
          ))}
        </span>
        <p className="min-w-0">
          <span className="block text-base/tight font-extrabold wrap-break-word text-ink">
            {shown.buffs.map((buff) => dict[`prep.council.${buff}`]).join(" + ")} · {shown.date}
          </span>
          <span className="block text-sm font-bold text-ink-muted">{format(dict["ministry.roster.filled"], { filled, total: shown.cells.length })}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 basis-64 flex-col gap-1">
          <label htmlFor="ministry-find" className="label mb-0">
            {dict["ministry.roster.find"]}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 inset-s-4 my-auto size-5 text-ink-faint" aria-hidden />
            <input
              id="ministry-find"
              type="search"
              className="input px-12"
              value={query}
              placeholder={dict["ministry.roster.find.placeholder"]}
              autoComplete="off"
              maxLength={40}
              dir="auto"
              onChange={(event) => {
                setQuery(event.target.value);
                setOnlyFree(false);
              }}
              onBlur={find}
              onKeyDown={(event) => {
                if (event.key === "Enter") find();
              }}
            />
            {searching && <LoaderCircle className="absolute inset-y-0 inset-e-4 my-auto size-5 animate-spin text-ink-faint" aria-hidden />}
          </div>
        </div>
        {free > 0 && (
          <button type="button" aria-pressed={onlyFree} className={clsx("btn-ghost btn-sm", onlyFree && "border-primary text-primary-strong")} onClick={() => setOnlyFree(!onlyFree)}>
            {onlyFree ? dict["ministry.roster.all"] : dict["ministry.roster.onlyFree"]}
          </button>
        )}
      </div>

      {nothing && !onlyFree && (
        <p className="text-sm font-bold text-ink-muted" role="status" dir="auto">
          {byId && lookup?.status === "found" ? format(dict["ministry.roster.find.noSlot"], { name: lookup.name ?? "" }) : dict["ministry.roster.find.none"]}
        </p>
      )}

      <ol className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ name, slot }) => {
          const local = hydrated ? localStart(shown.start, slot, locale) : null;
          const isMine = mine.has(slot);
          return (
            <li
              key={slot}
              className={clsx(
                "flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2",
                name === null ? "border-danger/50 bg-danger-soft" : isMine || matches(name, slot) ? "border-primary bg-primary-soft" : "border-line bg-card-soft",
              )}
            >
              <span className="shrink-0 text-start tabular" dir="ltr">
                <span className="block text-sm font-black text-ink">{slotClock(slot)}</span>
                {local && <span className="block text-xs font-semibold text-ink-faint">{local}</span>}
              </span>
              {name === null ? (
                <span className="text-sm font-extrabold text-danger">{dict["ministry.roster.free"]}</span>
              ) : (
                <span className="min-w-0 text-sm font-bold wrap-break-word text-ink" dir="auto">
                  {name}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {free > 0 && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-danger">{dict["ministry.roster.freeNote"]}</p>}
    </section>
  );
}
