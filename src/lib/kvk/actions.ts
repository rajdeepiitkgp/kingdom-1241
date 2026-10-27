"use server";

import { cookies, headers } from "next/headers";
import { systemAudit } from "@/lib/admin/audit";
import { notifyCouncil } from "@/lib/alerts";
import { getActiveChecklistPlan, getActiveKvkPlan, getActiveLeaderPlan } from "@/lib/data";
import { areaAccessToken, KVK_AREA_COOKIES, KVK_COOKIE_MAX_AGE, type KvkArea, passwordMatches } from "@/lib/kvk/access";
import { ADDRESS_POLICY, addressScope, countFailure, PLAN_ALERT, planScope, retryAfter, shouldAlert, triesLeft } from "@/lib/kvk/throttle";
import { addressHash, clearThrottle, countRecentAddresses, takeTry, updateThrottle } from "@/lib/kvk/throttle-store";
import { createLogger, requestId } from "@/lib/log";

/**
 * Server Actions for the KvK page locks (the battle plan, the rally-leader
 * plan and the commander checklist, each with its own password and cookie). Like every Server Function these are
 * reachable by a direct POST, so the password check happens here, never in
 * the browser. The password is never logged. Wrong tries lock the guessing
 * address (see throttle.ts) and, past a plan-wide threshold, alert the council;
 * a legitimate player is never held up by somebody else's guessing.
 */

export interface UnlockState {
  status: "idle" | "ok" | "empty" | "wrong" | "unavailable" | "throttled";
  /** `throttled`: when (ms since epoch) this address may try again. */
  retryAt?: number;
  /** `wrong`: tries left from this address before its lockout. */
  triesLeft?: number;
}

const log = createLogger("kvk");

/** What an unlock checks against: the plan the page belongs to and that page's password. */
interface LockedPage {
  planId: string;
  slug: string;
  password: string;
}

/** Per page: where its password comes from and how a brute-force alert names it. */
const AREAS: Record<KvkArea, { load: () => Promise<LockedPage | null>; what: string; auditAction: string; auditTable: string }> = {
  plan: {
    load: async () => {
      const plan = await getActiveKvkPlan();
      return plan && { planId: plan.id, slug: plan.slug, password: plan.password };
    },
    what: "battle-plan",
    auditAction: "kvk.bruteforce",
    auditTable: "kvk_plans",
  },
  leaders: {
    load: async () => {
      const page = await getActiveLeaderPlan();
      return page && { planId: page.planId, slug: page.slug, password: page.password };
    },
    what: "rally-leader",
    auditAction: "kvk_leaders.bruteforce",
    auditTable: "kvk_leader_briefs",
  },
  checklist: {
    load: async () => {
      const page = await getActiveChecklistPlan();
      return page && { planId: page.planId, slug: page.slug, password: page.password };
    },
    what: "commander-checklist",
    auditAction: "kvk_checklist.bruteforce",
    auditTable: "kvk_checklist_briefs",
  },
};

export async function unlockKvk(previous: UnlockState, formData: FormData): Promise<UnlockState> {
  return unlockArea("plan", previous, formData);
}

export async function unlockLeaders(previous: UnlockState, formData: FormData): Promise<UnlockState> {
  return unlockArea("leaders", previous, formData);
}

export async function unlockChecklist(previous: UnlockState, formData: FormData): Promise<UnlockState> {
  return unlockArea("checklist", previous, formData);
}

async function unlockArea(area: KvkArea, _previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const requestHeaders = await headers();
  const reqId = requestId(requestHeaders);
  const password = String(formData.get("password") ?? "").trim();
  if (!password) return { status: "empty" };

  const page = await AREAS[area].load();
  if (!page) {
    log.warn("Unlock attempted but nothing to unlock", { reqId, area });
    return { status: "unavailable" };
  }

  const now = Date.now();
  const scopes = { address: addressScope(page.planId, addressHash(requestHeaders), area), plan: planScope(page.planId, area) };
  // The try is counted before the password is checked, so parallel requests can't outrun the lockout.
  const attempt = await takeTry(scopes.address, now, ADDRESS_POLICY);
  if (!attempt.allowed) {
    log.info("Unlock refused: address locked", { reqId, area, plan: page.slug, waitMs: attempt.retryAt - now });
    return { status: "throttled", retryAt: attempt.retryAt };
  }

  if (!passwordMatches(password, page.password)) {
    let alert = false;
    const plan = await updateThrottle(scopes.plan, (state) => {
      const next = countFailure(state, now, PLAN_ALERT);
      alert = shouldAlert(next, PLAN_ALERT);
      if (alert) next.alertedAt = now;
      return next;
    });
    const planFailures = plan.status === "ok" ? (plan.after?.failures ?? 0) : 0;
    const lock = retryAfter(attempt.state, now);
    log.info("Unlock failed: wrong password", { reqId, area, plan: page.slug, addressFailures: attempt.state?.failures, planFailures, lockMs: lock });
    if (plan.status === "ok" && alert) await reportBruteForce(area, page, planFailures, plan.after?.windowStartedAt ?? now);
    if (lock > 0) return { status: "throttled", retryAt: now + lock };
    return { status: "wrong", triesLeft: triesLeft(attempt.state, now, ADDRESS_POLICY) };
  }

  (await cookies()).set({
    name: KVK_AREA_COOKIES[area],
    value: areaAccessToken(area, page.planId, page.password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: KVK_COOKIE_MAX_AGE,
  });
  if (attempt.state) await clearThrottle(scopes.address);
  log.info("Unlocked", { reqId, area, plan: page.slug });
  return { status: "ok" };
}

/** Once per hour-long window: an audit entry for the admin overview, a warning in the logs and a Discord alert. */
async function reportBruteForce(area: KvkArea, page: LockedPage, failures: number, since: number): Promise<void> {
  const { what, auditAction, auditTable } = AREAS[area];
  const addresses = await countRecentAddresses(page.planId, since, area);
  const summary = `${failures} wrong passwords from ${addresses} address${addresses === 1 ? "" : "es"} within an hour`;
  log.warn(`Brute-force attempt on the ${what} password`, { area, plan: page.slug, failures, addresses });
  await systemAudit(auditAction, auditTable, page.planId, { slug: page.slug, failures, addresses, summary });
  await notifyCouncil(
    `⚠️ Brute-force attempt on the ${what} password (${page.slug}): ${summary}. ` +
      "Addresses that keep guessing are locked out automatically; consider changing the password in the admin area and sharing the new one on Discord.",
  );
}

export async function lockKvk(): Promise<void> {
  (await cookies()).delete(KVK_AREA_COOKIES.plan);
}

export async function lockLeaders(): Promise<void> {
  (await cookies()).delete(KVK_AREA_COOKIES.leaders);
}

export async function lockChecklist(): Promise<void> {
  (await cookies()).delete(KVK_AREA_COOKIES.checklist);
}
