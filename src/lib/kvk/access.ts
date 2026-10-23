import { createHmac, timingSafeEqual } from "node:crypto";
import { createLogger } from "@/lib/log";

/**
 * Access to the KvK battle plan is one shared password per plan (set by the
 * council in `kvk_plans.password`). After a correct entry the visitor gets an
 * HttpOnly cookie holding an HMAC of the plan id + password, so:
 *   - the password itself is never stored in the browser,
 *   - changing the password in the table logs everyone out at once,
 *   - a different plan (next KvK) needs a fresh unlock.
 *
 * This is a low-friction lock against casual snooping by other kingdoms, not
 * account security — the whole kingdom shares the password by design.
 */

export const KVK_COOKIE = "kd1241_kvk";

/** 30 days, long enough for one KvK cycle. */
export const KVK_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const log = createLogger("kvk");
let warnedAboutSecret = false;

/** Server secret used to sign the cookie (never shipped to the browser). */
export function kvkSessionSecret(): string {
  const secret = process.env.KVK_SESSION_SECRET?.trim() || process.env.TRANSLATE_WEBHOOK_SECRET?.trim();
  if (secret) return secret;
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    log.warn("KVK_SESSION_SECRET / TRANSLATE_WEBHOOK_SECRET not set — using an insecure development secret");
  }
  return "dev-only-insecure-kvk-secret";
}

export function kvkAccessToken(planId: string, password: string, secret = kvkSessionSecret()): string {
  return createHmac("sha256", secret).update(`${planId}\u0000${password}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** Is `token` (from the cookie) the current token of this plan? */
export function isValidKvkToken(
  token: string | undefined | null,
  planId: string,
  password: string,
  secret = kvkSessionSecret(),
): boolean {
  if (!token) return false;
  return safeEqual(token, kvkAccessToken(planId, password, secret));
}

/** Compare what the visitor typed with the plan's password (whitespace-insensitive, constant time). */
export function passwordMatches(provided: string, expected: string): boolean {
  const a = provided.trim();
  const b = expected.trim();
  if (!a || !b) return false;
  return safeEqual(a, b);
}
