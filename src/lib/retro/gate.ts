import { cookies } from "next/headers";
import { getActiveKvkPlan, getOpenRetrospective } from "@/lib/data";
import type { OpenRetrospective } from "@/lib/data/types";
import { isValidKvkToken, KVK_COOKIE } from "@/lib/kvk/access";

/**
 * Who may see the feedback form: anyone who has unlocked the battle plan. The
 * cookie is accepted for the retrospective's own plan and for the currently
 * active plan (the next battle may already be active while the previous one
 * collects feedback). Reads the request, so callers sit behind Suspense or run
 * in an action.
 */
export interface RetroAccess {
  retro: OpenRetrospective;
  unlocked: boolean;
}

export async function retroAccess(): Promise<RetroAccess | null> {
  const [retro, activePlan, store] = await Promise.all([getOpenRetrospective(), getActiveKvkPlan(), cookies()]);
  if (!retro) return null;
  const token = store.get(KVK_COOKIE)?.value;
  const unlocked =
    isValidKvkToken(token, retro.battle.planId, retro.battle.password) ||
    (activePlan !== null && isValidKvkToken(token, activePlan.id, activePlan.password));
  return { retro, unlocked };
}
