// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { type Buff, BUFFS, type ScoringDay } from "@/lib/kvk/prep";
import { cleanSlots, type Section, type SlotChoice } from "./ministry";

/**
 * A player's times per buff (pure, unit-tested): the safeguard for a council
 * that moves the buff days after players signed up.
 *
 * The page, the ranking and the assignment all work per buff **day**
 * (`slots`, `{ "<day>": [0…47] }`), and a day is only where the council
 * currently puts a buff. So an entry also keeps the half-hours the player
 * picked per **buff** (`times`), and when the days of a round change every
 * entry's `slots` are written anew from them (`planMove`, run by the Prep
 * days save in one database transaction):
 *
 *   swap           each buff's times apply on its new day;
 *   merge          the shared day takes the times of both buffs together,
 *                  and each buff still remembers its own;
 *   split again    each buff has its own times back; a player who signed up
 *                  or changed their times while the day was shared picked
 *                  one set, which then counts for both.
 *
 * The half-hours themselves never change: 20:00 on Monday becomes 20:00 on
 * the new day, and the player changes them or asks a moderator.
 */

export type BuffTimes = Partial<Record<Buff, number[]>>;

/** The stored value as the site reads it: known buffs only, clean slot lists, empty ones left out; null when there is none. */
export function parseBuffTimes(value: unknown): BuffTimes | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const stored = value as Record<string, unknown>;
  const times: BuffTimes = {};
  for (const buff of BUFFS) {
    const slots = Array.isArray(stored[buff]) ? cleanSlots(stored[buff] as unknown[]) : [];
    if (slots.length > 0) times[buff] = slots;
  }
  return times;
}

const sameSlots = (a: readonly number[] | undefined, b: readonly number[] | undefined): boolean => {
  const first = a ?? [];
  const second = b ?? [];
  return first.length === second.length && first.every((slot, i) => slot === second[i]);
};

/** Two choices name the same half-hours on the same days. */
export function sameChoice(a: SlotChoice, b: SlotChoice, days: readonly ScoringDay[]): boolean {
  return days.every((day) => sameSlots(a[day], b[day]));
}

/** The times per day these buffs' times give with the buff days as they are: a shared day takes both buffs' times together. */
export function slotsFromTimes(times: BuffTimes, sections: readonly Section[]): SlotChoice {
  const slots: SlotChoice = {};
  for (const section of sections) {
    const together = cleanSlots(section.buffs.flatMap((buff) => times[buff] ?? []));
    if (together.length > 0) slots[section.day] = together;
  }
  return slots;
}

/** The times per buff a choice per day stands for: every buff of a day gets that day's times. */
export function timesFromSlots(slots: SlotChoice, sections: readonly Section[]): BuffTimes {
  const times: BuffTimes = {};
  for (const section of sections) {
    const picked = slots[section.day];
    if (!picked || picked.length === 0) continue;
    for (const buff of section.buffs) times[buff] = [...picked];
  }
  return times;
}

/**
 * An entry's times per buff. The stored ones count while they still give the
 * entry's `slots`; an entry from before they were kept, or one an older
 * deploy saved since (it writes `slots` alone), is read from its `slots`.
 */
export function timesOf(entry: { times: BuffTimes | null; slots: SlotChoice }, sections: readonly Section[]): BuffTimes {
  const days = sections.map((section) => section.day);
  if (entry.times && sameChoice(slotsFromTimes(entry.times, sections), entry.slots, days)) return entry.times;
  return timesFromSlots(entry.slots, sections);
}

/**
 * The times per buff to store with a save. A day whose times the save left
 * as they were keeps what each of its buffs had (so on a shared day the two
 * buffs keep their own times through a save that only changed a number); a
 * day with new times gives them to each of its buffs.
 */
export function nextTimes(previous: { times: BuffTimes | null; slots: SlotChoice } | null, slots: SlotChoice, sections: readonly Section[]): BuffTimes {
  if (!previous) return timesFromSlots(slots, sections);
  const before = timesOf(previous, sections);
  const times: BuffTimes = {};
  for (const section of sections) {
    const picked = slots[section.day] ?? [];
    const kept = sameSlots(picked, previous.slots[section.day]);
    for (const buff of section.buffs) {
      const own = kept ? (before[buff] ?? []) : picked;
      if (own.length > 0) times[buff] = [...own];
    }
  }
  return times;
}

/** The buff days that change hands between two sets of buff days: a day that gains, loses or trades a buff. */
export function changedDays(before: readonly Section[], after: readonly Section[]): ScoringDay[] {
  const buffsOn = (sections: readonly Section[], day: ScoringDay) => [...(sections.find((section) => section.day === day)?.buffs ?? [])].sort().join("+");
  const days = [...new Set([...before, ...after].map((section) => section.day))].sort((a, b) => a - b);
  return days.filter((day) => buffsOn(before, day) !== buffsOn(after, day));
}

export interface MovedEntry {
  id: string;
  slots: SlotChoice;
  times: BuffTimes;
  /** The entry's times now fall on other days than before. */
  moved: boolean;
}

export interface MovePlan {
  /** Every entry of the round as it is stored after the move. */
  entries: MovedEntry[];
  /** The buff days that change hands: their rosters are made anew. */
  days: ScoringDay[];
  /** How many entries have times on another day now. */
  moved: number;
}

/** What a change of a round's buff days does to its sign-ups: every entry's times follow their buff. */
export function planMove(entries: ReadonlyArray<{ id: string; times: BuffTimes | null; slots: SlotChoice }>, before: readonly Section[], after: readonly Section[]): MovePlan {
  const days = changedDays(before, after);
  const compared = [...new Set([...before, ...after].map((section) => section.day))];
  const planned = entries.map((entry): MovedEntry => {
    const times = timesOf(entry, before);
    const slots = slotsFromTimes(times, after);
    return { id: entry.id, slots, times, moved: !sameChoice(slots, entry.slots, compared) };
  });
  return { entries: planned, days, moved: planned.filter((entry) => entry.moved).length };
}

/**
 * `1:construction;2:research;4:training`: which buff falls on which day. The sign-up form posts the one it was drawn
 * with, so a form that was open while the council moved the days is told to reload and is never read against other days.
 */
export const layoutOf = (sections: ReadonlyArray<{ day: number; buffs: readonly string[] }>): string =>
  [...sections]
    .sort((a, b) => a.day - b.day)
    .map((section) => `${section.day}:${[...section.buffs].sort().join("+")}`)
    .join(";");

/** `1-2`: the days a confirmation was given for (construction, research), so another choice asks again. */
export const moveToken = (schedule: { construction: number; research: number }): string => `${schedule.construction}-${schedule.research}`;
