// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { readConfig, writeConfig } from "@/lib/config/app-config";
import { offeredRounds, parsePrepScheduleForm, parsePrepSchedules, roundKey, sameSchedule, scheduleFor, withRound } from "@/lib/kvk/prep-schedule";
import { sectionsFor } from "@/lib/ministry/ministry";
import { ministryMemory, ministryStore } from "@/lib/ministry/store";
import { moveToken, planMove } from "@/lib/ministry/times";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField } from "./forms";

/**
 * The council's KvK prep buff days (`/admin/prep`): a moderator picks, for the
 * current and the next round, which of Days 1, 2 and 5 get the construction
 * and the research minister buff. Stored as one app_config value
 * (`prep_schedule`), read uncached by the prep page's gate, so a switch shows
 * on the next visit of everyone who has the battle plan unlocked. Re-checks
 * the role (reachable by a direct POST) and audits every save with the days
 * before and after.
 *
 * **A round players already signed up for** (the ministry sign-ups): their
 * times are kept per buff, so a swap, a shared day or a split moves every
 * entry's times to the buff's new day, the same half-hours (`planMove` in
 * src/lib/ministry/times.ts). The save says so first and wants a second tap;
 * then the entries, the rosters of the days that changed hands (dropped, to
 * be made anew) and the new days are written in one transaction
 * (`ministry_move_days`, migration 0030), which refuses when a sign-up
 * changed in between.
 */

const DAYS = (days: readonly number[]): string => days.map((day) => `Day ${day}`).join(" and ");

const NO_DATABASE: ActionState = { status: "error", message: "The prep days need the database." };

export async function savePrepSchedule(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const { current, next } = offeredRounds(new Date());
  const currentKey = roundKey(current);
  const parsed = parsePrepScheduleForm(formData, [currentKey, roundKey(next)]);
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;

  const { round, schedule } = parsed.value;
  try {
    const admin = createAdminClient();
    const stored = parsePrepSchedules(await readConfig(admin, "prep_schedule"));
    const before = scheduleFor(stored, round === currentKey ? current : next);
    if (sameSchedule(before, schedule) && stored[round]) return { status: "saved", message: "Nothing to save: those are the days already set." };
    const value = withRound(stored, round, schedule, currentKey);
    // Players who signed up for this round keep their times: they follow each buff to its new day.
    const store = ministryMemory() ? null : ministryStore();
    const signups = store && !sameSchedule(before, schedule) ? await store.list(round) : [];
    let moved: { signups: number; moved: number; rosters: number[] } | null = null;
    if (store && signups.length > 0) {
      const plan = planMove(signups, sectionsFor(before), sectionsFor(schedule));
      const roster = await store.roster(round);
      const rosters = plan.days.filter((day) => roster.assignedAt[day] !== undefined);
      if (formData.get("confirm") !== moveToken(schedule)) {
        return {
          status: "error",
          confirm: moveToken(schedule),
          message:
            `${signups.length} ${signups.length === 1 ? "player has" : "players have"} signed up for this round. Their times move with the buffs: the same hours on the new days` +
            ` (${plan.moved} of them ${plan.moved === 1 ? "gets" : "get"} other days and ${plan.moved === 1 ? "is" : "are"} asked to check).` +
            (rosters.length > 0 ? ` The appointments of ${DAYS(rosters)} are given out already: they are dropped and made again, so placings by hand and free times players took there are forgotten.` : "") +
            " Nothing is saved yet. Press Save again to go ahead.",
        };
      }
      const outcome = await store.moveDays(round, plan.entries.map((entry, index) => ({ ...entry, updatedAt: signups[index].updatedAt })), plan.days, value);
      if (outcome === "changed") return { status: "error", confirm: moveToken(schedule), message: "A sign-up was added or changed at the same moment, so nothing was saved. Press Save again." };
      // Before migration 0030 there is nothing to move the entries with: the days are saved as before.
      if (outcome === "unavailable") await writeConfig(admin, "prep_schedule", value);
      else moved = { signups: signups.length, moved: plan.moved, rosters };
    } else {
      await writeConfig(admin, "prep_schedule", value);
    }
    await audit(access.user, "prep.update", "app_config", "prep_schedule", { round, before, after: schedule, ...(moved ? { signups: moved } : {}) });
    log.info("Prep buff days saved", { round, construction: schedule.construction, research: schedule.research, signupsMoved: moved?.moved ?? 0 });
    revalidatePath(adminPath(localeField(formData), "/ministry"));
    revalidatePath(adminPath(localeField(formData), "/prep"));
    return {
      status: "saved",
      message:
        "Saved. Everyone who has the battle plan unlocked sees these days on the prep page from now on." +
        (moved ? ` ${moved.signups} sign-${moved.signups === 1 ? "up" : "ups"} came along with ${moved.signups === 1 ? "its" : "their"} times; look at the lists on the Ministry page.` : ""),
    };
  } catch (error) {
    return failed(log, "Saving the prep buff days", { message: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
  }
}
