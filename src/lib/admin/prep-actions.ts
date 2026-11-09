// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { readConfig, writeConfig } from "@/lib/config/app-config";
import { offeredRounds, parsePrepScheduleForm, parsePrepSchedules, roundKey, sameSchedule, scheduleFor, withRound } from "@/lib/kvk/prep-schedule";
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
 */

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
    await writeConfig(admin, "prep_schedule", withRound(stored, round, schedule, currentKey));
    await audit(access.user, "prep.update", "app_config", "prep_schedule", { round, before, after: schedule });
    log.info("Prep buff days saved", { round, construction: schedule.construction, research: schedule.research });
    revalidatePath(adminPath(localeField(formData), "/prep"));
    return { status: "saved", message: "Saved. Everyone who has the battle plan unlocked sees these days on the prep page from now on." };
  } catch (error) {
    return failed(log, "Saving the prep buff days", { message: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
  }
}
