// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getPrepSchedules } from "@/lib/config/settings";
import { getActiveKvkPlan } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { isValidKvkToken, KVK_COOKIE } from "@/lib/kvk/access";
import { roundFor } from "@/lib/kvk/prep";
import { scheduleFor } from "@/lib/kvk/prep-schedule";
import { PrepBoard } from "./PrepBoard";
import { PrepUnlock } from "./PrepUnlock";

/**
 * The prep page is public; only the council's buff days (which of Days 1, 2
 * and 5 get the construction and the research minister buff this round) ride
 * on the battle plan's cookie, the one every player has. Reads the cookie at
 * request time (so it renders inside <Suspense>), never passes the password
 * on, and without an active plan shows the public board alone: there is
 * nothing to unlock against.
 */
export async function PrepGate({ dict, locale }: { dict: Dictionary; locale: string }) {
  const [plan, cookieStore] = await Promise.all([getActiveKvkPlan(), cookies()]);
  const unlocked = plan !== null && isValidKvkToken(cookieStore.get(KVK_COOKIE)?.value, plan.id, plan.password);

  if (!unlocked) {
    const unlock = plan ? <PrepUnlock dict={dict} /> : null;
    return <PrepBoard dict={dict} locale={locale} council={null} unlock={unlock} />;
  }

  const schedules = await getPrepSchedules();
  // The round of the moment, so the unlocked table is right from its first paint; the browser's clock takes over after hydration.
  await connection();
  const current = scheduleFor(schedules, roundFor(new Date()));
  return <PrepBoard dict={dict} locale={locale} council={{ schedules, current }} />;
}
