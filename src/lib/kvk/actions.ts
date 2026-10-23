"use server";

import { cookies, headers } from "next/headers";
import { getActiveKvkPlan } from "@/lib/data";
import { KVK_COOKIE, KVK_COOKIE_MAX_AGE, kvkAccessToken, passwordMatches } from "@/lib/kvk/access";
import { createLogger, requestId } from "@/lib/log";

/**
 * Server Actions for the KvK page lock. Like every Server Function these are
 * reachable by a direct POST, so the password check happens here, never in
 * the browser. The password is never logged.
 */

export interface UnlockState {
  status: "idle" | "ok" | "empty" | "wrong" | "unavailable";
}

const log = createLogger("kvk");

export async function unlockKvk(_previous: UnlockState, formData: FormData): Promise<UnlockState> {
  const reqId = requestId(await headers());
  const password = String(formData.get("password") ?? "").trim();
  if (!password) return { status: "empty" };

  const plan = await getActiveKvkPlan();
  if (!plan) {
    log.warn("Unlock attempted but no active plan", { reqId });
    return { status: "unavailable" };
  }

  if (!passwordMatches(password, plan.password)) {
    // A small delay makes guessing slower without hurting real players.
    await new Promise((resolve) => setTimeout(resolve, 600));
    log.info("Unlock failed: wrong password", { reqId, plan: plan.slug });
    return { status: "wrong" };
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
  log.info("Unlocked", { reqId, plan: plan.slug });
  return { status: "ok" };
}

export async function lockKvk(): Promise<void> {
  (await cookies()).delete(KVK_COOKIE);
}
