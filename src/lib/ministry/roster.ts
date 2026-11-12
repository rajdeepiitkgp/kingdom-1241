// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { systemAudit } from "@/lib/admin/audit";
import type { ScoringDay } from "@/lib/kvk/prep";
import { createLogger } from "@/lib/log";
import { dayStart } from "@/lib/kvk/prep";
import { assignDay, lateSlots } from "./assign";
import { rankSection, sectionOn, sectionState } from "./ministry";
import type { MinistryRound } from "./state";
import { type AssignOutcome, type MinistryStore, ministryMemory, NO_ROSTER, type RoundRoster } from "./store";

export { publishedRoster } from "./store";

/**
 * The rosters of a round (server only): who holds which appointment, and the
 * run that decides it (assign.ts has the rules).
 *
 * **The assignment runs by itself at a day's deadline.** Nothing is scheduled:
 * the first read of the round after the deadline (a player opening the
 * Ministry page, a moderator opening the admin page) finds the day without a
 * roster and runs it, once (`first`, kept by the database). Nobody can see a
 * roster without reading the round, so no visitor ever meets an unassigned day
 * past its deadline. From then on moderators run it again with their button,
 * which keeps everyone placed by hand and everyone who took a free appointment.
 *
 * **Draft and published.** The run at the deadline is published at once. What
 * moderators change afterwards (a new run, a move, an added or removed player)
 * changes only the working appointments, a draft they alone see; players keep
 * seeing the published copy (`publishedRoster`) until a moderator presses
 * Publish, and Discard takes the draft back to it.
 */

const log = createLogger("ministry");

const problem = (error: unknown): string => (error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error));

export interface AssignmentRun {
  outcome: AssignOutcome;
  /** Appointments the run gave out itself. */
  placed: number;
  /** Players on the day's list without an appointment after it. */
  unplaced: number;
}

/** Runs a buff day's assignment over the round's current sign-ups. Throws on a database problem. */
export async function runAssignment(store: MinistryStore, round: MinistryRound, day: ScoringDay, first: boolean): Promise<AssignmentRun> {
  const section = sectionOn(round.sections, day);
  if (!section) return { outcome: "unavailable", placed: 0, unplaced: 0 };
  const [signups, roster] = await Promise.all([store.list(round.key), store.roster(round.key)]);
  if (!roster.available) return { outcome: "unavailable", placed: 0, unplaced: 0 };
  const plan = assignDay(day, rankSection(signups, section), roster.appointments);
  const rows = plan.appointments.filter((held) => held.source === "auto").map(({ signupId, slot }) => ({ signupId, slot }));
  const outcome = await store.assign(round.key, day, rows, first);
  return { outcome, placed: rows.length, unplaced: plan.unplaced.length };
}

/** The days of a round whose deadline has passed. */
export function closedDays(round: MinistryRound, now: Date): ScoringDay[] {
  return round.sections.filter(({ day }) => sectionState(now, round.deadlines[day] as Date) === "closed").map(({ day }) => day);
}

/**
 * The round's roster, after running the assignment of every day that is past its deadline and has none yet
 * (only while the round is open for players: a round the council closed waits for their button).
 * Never throws: on a problem the roster is what could be read, or none.
 */
export async function rosterFor(store: MinistryStore, round: MinistryRound, now: Date): Promise<RoundRoster> {
  let roster: RoundRoster;
  try {
    roster = await store.roster(round.key);
  } catch (error) {
    log.warn("Could not read the ministry roster", { round: round.key, error: problem(error) });
    return NO_ROSTER;
  }
  if (!roster.available || !round.settings.open) return roster;
  const due = closedDays(round, now).filter((day) => !roster.assignedAt[day]);
  if (due.length === 0) return roster;
  let ran = false;
  for (const day of due) {
    try {
      const run = await runAssignment(store, round, day, true);
      if (run.outcome === "done") {
        ran = true;
        // The run at the deadline goes live by itself; whatever moderators change afterwards waits for their Publish.
        await store.publish(round.key, day);
        log.info("Ministry assignment ran at the deadline", { round: round.key, day, placed: run.placed, unplaced: run.unplaced });
        if (!ministryMemory()) await systemAudit("ministry.assign", "ministry_rosters", null, { round: round.key, day, placed: run.placed, unplaced: run.unplaced, at: "deadline" });
      } else if (run.outcome === "skipped") ran = true; // another visitor's request ran it a moment ago
    } catch (error) {
      log.error("The ministry assignment at the deadline failed", { round: round.key, day, error: problem(error) });
    }
  }
  if (!ran) return roster;
  try {
    return await store.roster(round.key);
  } catch (error) {
    log.warn("Could not read the ministry roster after its assignment", { round: round.key, error: problem(error) });
    return roster;
  }
}

/** The days whose roster players see: past the deadline and assigned (hand it `publishedRoster(...)` for the players' pages: then assigned means published). */
export function rosterDays(round: MinistryRound, roster: RoundRoster, now: Date): ScoringDay[] {
  return closedDays(round, now).filter((day) => Boolean(roster.assignedAt[day]));
}

/** Per buff day, the half-hours a player can still take after its deadline (`lateSlots`); a day with none is left out. */
export type LateOffer = Partial<Record<ScoringDay, number[]>>;

/**
 * What late players are offered, from the round's whole roster (not the players' copy): only on days whose roster is
 * out (past the deadline and published), only half-hours that are free for players and in the moderators' draft, and
 * only those still ahead.
 */
export function lateOffer(round: MinistryRound, roster: RoundRoster, now: Date): LateOffer {
  const offer: LateOffer = {};
  if (!roster.available || !roster.drafts) return offer;
  for (const day of closedDays(round, now)) {
    const live = roster.published[day];
    if (!live) continue;
    const free = lateSlots(roster.appointments, live, day, { dayStart: dayStart(round.round, day).getTime(), now: now.getTime() });
    if (free.length > 0) offer[day] = free;
  }
  return offer;
}
