// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { LoaderCircle, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import type { Buff, ScoringDay } from "@/lib/kvk/prep";
import { findMinistryAppointments, type FindState } from "@/lib/ministry/actions";
import { SLOT_MINUTES, slotLabel } from "@/lib/ministry/ministry";
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

/** A half-hour in the visitor's own time ("10:30–11:00", with the weekday when it is another day there than in UTC), or null where the browser can't say. */
function localRange(dayStart: number, slot: number, locale: string): string | null {
  try {
    const from = new Date(dayStart + slot * SLOT_MINUTES * MINUTE);
    const to = new Date(from.getTime() + SLOT_MINUTES * MINUTE);
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", numberingSystem: "latn" });
    const range = `${time.format(from)}–${time.format(to)}`;
    return from.getDay() === from.getUTCDay() ? range : `${new Intl.DateTimeFormat(locale, { weekday: "short" }).format(from)} ${range}`;
  } catch {
    return null;
  }
}

export function MinistryRoster({
  days,
  lateDays,
  own,
  hydrated,
  dict,
  locale,
}: {
  days: RosterDay[];
  /** The days whose free appointments players can still take themselves in the form above. */
  lateDays: number[];
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
  const each = shown.cells.map((name, slot) => ({ name, slot }));
  const rows = onlyFree ? each.filter(({ name }) => name === null) : filtering ? each.filter(({ name, slot }) => matches(name, slot)) : each;
  const nothing = (byId && lookup !== null && lookup.status !== "skipped" && typeof idSlot !== "number") || (!byId && needle !== "" && rows.length === 0 && !onlyFree);

  return (
    <section className="card @container space-y-4 p-5" data-tour="ministry-roster">
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

      {/* A table from the day's first half-hour to its last, as the council publishes it: each time with its start and end, the visitor's own time in a column of its own. */}
      {rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-start text-xs font-extrabold text-ink-muted">
              <th scope="col" className="py-2 pe-3 text-start">
                {dict["ministry.roster.col.utc"]}
              </th>
              {hydrated && (
                <th scope="col" className="hidden py-2 pe-3 text-start @[17rem]:table-cell">
                  {dict["ministry.roster.col.local"]}
                </th>
              )}
              <th scope="col" className="py-2 text-start">
                {dict["ministry.roster.col.player"]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, slot }) => {
              const local = hydrated ? localRange(shown.start, slot, locale) : null;
              const marked = name !== null && (mine.has(slot) || matches(name, slot));
              return (
                <tr key={slot} className={clsx("border-b border-line/60", name === null ? "bg-danger-soft" : marked && "bg-primary-soft")}>
                  {/* The direction sits on the text, not the cell: a cell's own direction would put its end padding on the wrong side in Arabic. */}
                  <td className="py-2 ps-2 pe-3 font-black whitespace-nowrap text-ink tabular">
                    <span dir="ltr">{slotLabel(slot)}</span>
                    {/* Where three columns don't fit (a phone at the largest text size) the visitor's time sits under the UTC time, with its name: a bare time there would read as the end. */}
                    {local && (
                      <span className="block text-xs font-semibold text-ink-muted @[17rem]:hidden">
                        {dict["ministry.roster.col.local"]} <span dir="ltr">{local}</span>
                      </span>
                    )}
                  </td>
                  {hydrated && (
                    <td className="hidden py-2 pe-3 font-semibold whitespace-nowrap text-ink-muted tabular @[17rem]:table-cell">
                      <span dir="ltr">{local ?? "—"}</span>
                    </td>
                  )}
                  {/* max-w-0: the name takes what the two time columns leave and wraps inside it, at any text size. */}
                  <td className="w-full max-w-0 py-2 pe-2">
                    {name === null ? (
                      <span className="font-extrabold text-danger">{dict["ministry.roster.free"]}</span>
                    ) : (
                      <span className="font-bold wrap-break-word text-ink" dir="auto">
                        {name}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {free > 0 && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-danger">{lateDays.includes(shown.day) ? dict["ministry.roster.freeNote.take"] : dict["ministry.roster.freeNote"]}</p>}
    </section>
  );
}
