// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { cookies } from "next/headers";
import { getPrepSchedules } from "@/lib/config/settings";
import { getActiveKvkPlan } from "@/lib/data";
import { isValidKvkToken, KVK_COOKIE } from "@/lib/kvk/access";
import type { PrepRound, PrepSchedule, ScoringDay } from "@/lib/kvk/prep";
import { offeredRounds, roundKey, scheduleFor } from "@/lib/kvk/prep-schedule";
import { createLogger } from "@/lib/log";
import { CLOSED_ROUND, deadlineFor, type MinistrySettings, roundOver, type RoundSettings, type Section, sectionsFor, sectionState } from "./ministry";
import { type MinistryStore, ministryStore } from "./store";

/**
 * What the ministry pages and actions work on (server only): the rounds the
 * site offers (the one in progress or next up, and the one after it) with
 * their buff days from /admin/prep, their switch and their deadlines. Never
 * throws: without a database, before migration 0026 or on a failed read the
 * rounds are simply closed.
 */

const log = createLogger("ministry");

export interface MinistryRound {
  key: string;
  round: PrepRound;
  schedule: PrepSchedule;
  sections: Section[];
  settings: RoundSettings;
  /** Every buff day's deadline: the council's, else a day before the day starts. */
  deadlines: Partial<Record<ScoringDay, Date>>;
}

function describe(round: PrepRound, schedule: PrepSchedule, settings: MinistrySettings): MinistryRound {
  const key = roundKey(round);
  const sections = sectionsFor(schedule);
  const own = settings[key] ?? CLOSED_ROUND;
  const deadlines: MinistryRound["deadlines"] = {};
  for (const { day } of sections) deadlines[day] = deadlineFor(own, round, day);
  return { key, round, schedule, sections, settings: own, deadlines };
}

/** The current and the next round as the admin page lists them. */
export async function ministryRounds(now: Date, store: MinistryStore | null = ministryStore()): Promise<{ rounds: MinistryRound[]; available: boolean }> {
  const { current, next } = offeredRounds(now);
  const schedules = await getPrepSchedules();
  let settings: MinistrySettings = {};
  let available = store !== null;
  if (store) {
    try {
      settings = await store.settings();
    } catch (error) {
      available = false;
      log.warn("Could not read the ministry settings; sign-ups count as closed", { error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    }
  }
  return { rounds: [current, next].map((round) => describe(round, scheduleFor(schedules, round), settings)), available };
}

/** The round players sign up for now: the first offered one that moderators opened and that isn't over. */
export async function openMinistryRound(now: Date, store: MinistryStore | null = ministryStore()): Promise<MinistryRound | null> {
  if (!store) return null;
  const { rounds } = await ministryRounds(now, store);
  return rounds.find((entry) => entry.settings.open && !roundOver(now, entry.round, entry.sections)) ?? null;
}

/** The buff days whose deadline is still ahead. */
export function openDays(round: MinistryRound, now: Date): ScoringDay[] {
  return round.sections.filter(({ day }) => sectionState(now, round.deadlines[day] as Date) === "open").map(({ day }) => day);
}

/** The visitor has the battle plan unlocked (the cookie every player has). Reads the request: behind Suspense or in an action. */
export async function ministryUnlocked(): Promise<{ plan: boolean; unlocked: boolean }> {
  const [plan, store] = await Promise.all([getActiveKvkPlan(), cookies()]);
  return { plan: plan !== null, unlocked: plan !== null && isValidKvkToken(store.get(KVK_COOKIE)?.value, plan.id, plan.password) };
}
