"use server";

import { cookies, headers } from "next/headers";
import { systemAudit } from "@/lib/admin/audit";
import { notifyCouncil } from "@/lib/alerts";
import { getActiveKvkPlan } from "@/lib/data";
import { KVK_COOKIE, KVK_COOKIE_MAX_AGE, kvkAccessToken, passwordMatches } from "@/lib/kvk/access";
import { ADDRESS_POLICY, addressScope, countFailure, PLAN_ALERT, planScope, recordFailure, retryAfter, shouldAlert, triesLeft } from "@/lib/kvk/throttle";
import { addressHash, clearThrottle, countRecentAddresses, loadThrottle, saveThrottle } from "@/lib/kvk/throttle-store";
import { createLogger, requestId } from "@/lib/log";

/**
 * Server Actions for the KvK page lock. Like every Server Function these are
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

export async function unlockKvk(_previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const requestHeaders = await headers();
  const reqId = requestId(requestHeaders);
  const password = String(formData.get("password") ?? "").trim();
  if (!password) return { status: "empty" };

  const plan = await getActiveKvkPlan();
  if (!plan) {
    log.warn("Unlock attempted but no active plan", { reqId });
    return { status: "unavailable" };
  }

  const now = Date.now();
  const scopes = { address: addressScope(plan.id, addressHash(requestHeaders)), plan: planScope(plan.id) };
  const [addressState, planState] = await loadThrottle([scopes.address, scopes.plan]);
  const wait = retryAfter(addressState, now);
  if (wait > 0) {
    log.info("Unlock refused: address locked", { reqId, plan: plan.slug, waitMs: wait });
    return { status: "throttled", retryAt: now + wait };
  }

  if (!passwordMatches(password, plan.password)) {
    const nextAddress = recordFailure(addressState, now, ADDRESS_POLICY);
    const nextPlan = countFailure(planState, now, PLAN_ALERT);
    const alert = shouldAlert(nextPlan, PLAN_ALERT);
    if (alert) nextPlan.alertedAt = now;
    await saveThrottle([
      { scope: scopes.address, state: nextAddress },
      { scope: scopes.plan, state: nextPlan },
    ]);
    const lock = retryAfter(nextAddress, now);
    log.info("Unlock failed: wrong password", { reqId, plan: plan.slug, addressFailures: nextAddress.failures, planFailures: nextPlan.failures, lockMs: lock });
    if (alert) await reportBruteForce(plan.slug, plan.id, nextPlan.failures, nextPlan.windowStartedAt);
    if (lock > 0) return { status: "throttled", retryAt: now + lock };
    return { status: "wrong", triesLeft: triesLeft(nextAddress, now, ADDRESS_POLICY) };
  }

  (await cookies()).set({
    name: KVK_COOKIE,
    value: kvkAccessToken(plan.id, plan.password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: KVK_COOKIE_MAX_AGE,
  });
  if (addressState) await clearThrottle(scopes.address);
  log.info("Unlocked", { reqId, plan: plan.slug });
  return { status: "ok" };
}

/** Once per hour-long window: an audit entry for the admin overview, a warning in the logs and a Discord alert. */
async function reportBruteForce(slug: string, planId: string, failures: number, since: number): Promise<void> {
  const addresses = await countRecentAddresses(planId, since);
  const summary = `${failures} wrong passwords from ${addresses} address${addresses === 1 ? "" : "es"} within an hour`;
  log.warn("Brute-force attempt on the battle-plan password", { plan: slug, failures, addresses });
  await systemAudit("kvk.bruteforce", "kvk_plans", planId, { slug, failures, addresses, summary });
  await notifyCouncil(
    `⚠️ Brute-force attempt on the battle-plan password (${slug}): ${summary}. ` +
      "Addresses that keep guessing are locked out automatically; consider changing the password in the admin area and sharing the new one on Discord.",
  );
}

export async function lockKvk(): Promise<void> {
  (await cookies()).delete(KVK_COOKIE);
}
