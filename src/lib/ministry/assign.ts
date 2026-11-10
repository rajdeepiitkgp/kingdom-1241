// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { ScoringDay } from "@/lib/kvk/prep";
import { type RankedSignup, type Signup, slotLabel, SLOTS_PER_DAY } from "./ministry";

/**
 * Who gets which appointment on a buff day (pure, unit-tested).
 *
 * The council's rules: as many of the day's 48 appointments filled as
 * possible; a player is only ever put into a time they picked; one
 * appointment per player and day; when two players can't both be placed, the
 * higher score gets the place (on equal scores whoever signed up first); and
 * players a moderator placed by hand, or who took a free appointment after the
 * deadline, stay where they are.
 *
 * `assignSlots` goes down the ranked list and finds each player a place,
 * moving players placed earlier to another time they also picked when that
 * makes room (an augmenting path, as in bipartite matching). A player who was
 * placed is never dropped again, only moved, so nobody loses their place to a
 * lower score, and no other way of placing could fill more appointments.
 */

/** `auto`: placed by the assignment. `moderator`: placed by hand. `late`: took a free appointment after the deadline. */
export type AppointmentSource = "auto" | "moderator" | "late";

export const APPOINTMENT_SOURCES: readonly AppointmentSource[] = ["auto", "moderator", "late"];

export interface Appointment {
  signupId: string;
  day: ScoringDay;
  /** The half-hour slot, 0–47. */
  slot: number;
  source: AppointmentSource;
}

/** Appointments the assignment leaves alone and plans around. */
export const isFixed = (appointment: Pick<Appointment, "source">): boolean => appointment.source !== "auto";

export interface Candidate {
  id: string;
  /** The slots the player can take. */
  slots: readonly number[];
}

/**
 * A slot for as many candidates as possible, the earlier in the list the surer.
 * `taken` are slots that are not to be given out; candidates listed in `placed` already have theirs.
 */
export function assignSlots(ranked: readonly Candidate[], taken: ReadonlySet<number> = new Set(), placed: ReadonlySet<string> = new Set()): Map<string, number> {
  const owner = new Map<number, Candidate>();
  const usable = (candidate: Candidate) => [...new Set(candidate.slots)].filter((slot) => Number.isInteger(slot) && slot >= 0 && slot < SLOTS_PER_DAY && !taken.has(slot)).sort((a, b) => a - b);
  const options = new Map<string, number[]>();

  const place = (candidate: Candidate, seen: Set<number>): boolean => {
    for (const slot of options.get(candidate.id) ?? []) {
      if (seen.has(slot)) continue;
      seen.add(slot);
      const holder = owner.get(slot);
      if (!holder || place(holder, seen)) {
        owner.set(slot, candidate);
        return true;
      }
    }
    return false;
  };

  for (const candidate of ranked) {
    if (placed.has(candidate.id) || options.has(candidate.id)) continue;
    options.set(candidate.id, usable(candidate));
    place(candidate, new Set());
  }
  return new Map([...owner].map(([slot, candidate]) => [candidate.id, slot]));
}

export interface DayAssignment {
  /** The day's appointments after the run: the fixed ones as they were, and the assignment's own. */
  appointments: Appointment[];
  /** Ranked players the day has no place for: every time they picked went to a higher score. */
  unplaced: string[];
}

/**
 * A buff day's assignment. `ranked` is the day's list (`rankSection`: highest score first, nobody set aside);
 * `current` are the day's appointments so far, of which only the fixed ones of players still on the list are kept.
 */
export function assignDay<T extends Signup>(day: ScoringDay, ranked: readonly RankedSignup<T>[], current: readonly Appointment[] = []): DayAssignment {
  const onList = new Set(ranked.map(({ signup }) => signup.id));
  const kept: Appointment[] = [];
  const takenSlots = new Set<number>();
  const placedIds = new Set<string>();
  for (const appointment of current) {
    if (appointment.day !== day || !isFixed(appointment) || !onList.has(appointment.signupId)) continue;
    if (takenSlots.has(appointment.slot) || placedIds.has(appointment.signupId)) continue;
    kept.push(appointment);
    takenSlots.add(appointment.slot);
    placedIds.add(appointment.signupId);
  }
  const given = assignSlots(
    ranked.map(({ signup }) => ({ id: signup.id, slots: signup.slots[day] ?? [] })),
    takenSlots,
    placedIds,
  );
  const auto: Appointment[] = [...given].map(([signupId, slot]) => ({ signupId, day, slot, source: "auto" }));
  return {
    appointments: [...kept, ...auto].sort((a, b) => a.slot - b.slot),
    unplaced: ranked.map(({ signup }) => signup.id).filter((id) => !placedIds.has(id) && !given.has(id)),
  };
}

/** The day's 48 appointments in order: who holds each, or null for a free one. */
export function rosterOf<T extends Pick<Appointment, "day" | "slot">>(appointments: readonly T[], day: ScoringDay): Array<T | null> {
  const roster: Array<T | null> = Array.from({ length: SLOTS_PER_DAY }, () => null);
  for (const appointment of appointments) if (appointment.day === day && appointment.slot >= 0 && appointment.slot < SLOTS_PER_DAY) roster[appointment.slot] = appointment;
  return roster;
}

/** The slots nobody holds, optionally only those that start after `now` (`dayStart` = 00:00 UTC of the day, ms). */
export function freeSlots(appointments: readonly Pick<Appointment, "day" | "slot">[], day: ScoringDay, upcoming?: { dayStart: number; now: number }): number[] {
  const free: number[] = [];
  rosterOf(appointments, day).forEach((held, slot) => {
    if (held) return;
    if (upcoming && upcoming.dayStart + slot * 30 * 60_000 <= upcoming.now) return;
    free.push(slot);
  });
  return free;
}

/**
 * The slots of a day where the moderators' working roster differs from the one players see (another player, newly
 * filled, newly free): what a Publish would change. How a player came to a slot (`source`) is no difference.
 */
export function draftChanges(working: readonly Pick<Appointment, "day" | "slot" | "signupId">[], published: readonly Pick<Appointment, "day" | "slot" | "signupId">[], day: ScoringDay): number[] {
  const now = rosterOf(working, day);
  const live = rosterOf(published, day);
  return now.flatMap((held, slot) => ((held?.signupId ?? null) === (live[slot]?.signupId ?? null) ? [] : [slot]));
}

/** The earliest free slot among a player's own times, or null: where someone who joins a day after its appointments were given out goes, without anyone else moving. */
export function firstFreeOwn(appointments: readonly Pick<Appointment, "day" | "slot">[], day: ScoringDay, own: readonly number[]): number | null {
  const free = new Set(freeSlots(appointments, day));
  return [...own].sort((a, b) => a - b).find((slot) => free.has(slot)) ?? null;
}

/** A moderator's or a late player's place: the reason it can't be given, or null. */
export function placementProblem(appointments: readonly Appointment[], day: ScoringDay, signupId: string, slot: number): "badSlot" | "slotTaken" | null {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS_PER_DAY) return "badSlot";
  const holder = appointments.find((appointment) => appointment.day === day && appointment.slot === slot);
  return holder && holder.signupId !== signupId ? "slotTaken" : null;
}

/** The day's roster as lines for the game chat: `14:30–15:00 [TAG] Name` (UTC, start and end), free appointments as `14:30–15:00 —` when `withFree`. */
export function rosterChat(roster: ReadonlyArray<{ name: string } | null>, heading: string, withFree = false): string {
  const lines = roster.flatMap((held, slot) => (held ? [`${slotLabel(slot)} ${held.name}`] : withFree ? [`${slotLabel(slot)} —`] : []));
  return [heading, ...lines].join("\n");
}
