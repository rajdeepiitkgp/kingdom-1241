import { HOUR, MINUTE } from "@/lib/time";

/**
 * Brute-force rules for the shared KvK password (pure, unit-tested; storage
 * in throttle-store.ts). The password is deliberately simple so players can
 * remember it, so guessing is handled in two ways that never hold up a real
 * player because of somebody else:
 *
 *   - one address: five wrong tries within 15 minutes lock that address for
 *     an hour, and every further lockout lasts twice as long (2 h, 4 h … up
 *     to a day). The form shows a countdown.
 *   - the plan as a whole: wrong tries from every address are counted per
 *     hour. Past a threshold the site records a "brute-force attempt" entry
 *     in the admin change log and alerts the council (Discord webhook), who
 *     can change the password. Nobody is locked out by this layer.
 *
 * Lockouts answer "try again in …" instead of sleeping, so an attack costs the
 * site no function time.
 */

export interface ThrottleState {
  /** Wrong tries in the current window. */
  failures: number;
  /** When the current window started (ms since epoch). */
  windowStartedAt: number;
  /** Until when tries from this address are refused (ms since epoch), or null. */
  lockedUntil: number | null;
  /** How many lockouts the address has had; each one doubles the next duration. */
  lockouts: number;
  /** Plan scope: when the council was alerted in this window, or null. */
  alertedAt: number | null;
}

export interface LockoutPolicy {
  window: number;
  /** The try that reaches this count triggers a lockout. */
  maxFailures: number;
  /** First lockout; doubles with every further one, up to maxLock. */
  firstLock: number;
  maxLock: number;
}

export interface AlertPolicy {
  window: number;
  /** Wrong tries per window, from any address, that count as a brute-force attempt. */
  threshold: number;
}

export const ADDRESS_POLICY: LockoutPolicy = { window: 15 * MINUTE, maxFailures: 5, firstLock: HOUR, maxLock: 24 * HOUR };
export const PLAN_ALERT: AlertPolicy = { window: HOUR, threshold: 30 };

const EMPTY: ThrottleState = { failures: 0, windowStartedAt: 0, lockedUntil: null, lockouts: 0, alertedAt: null };

/** Milliseconds until the address accepts a try again; 0 when it is open. */
export function retryAfter(state: ThrottleState | null, now: number): number {
  if (!state?.lockedUntil) return 0;
  return Math.max(0, state.lockedUntil - now);
}

/** An address's state after one more wrong password. The lockout count survives new windows (that is the doubling). */
export function recordFailure(state: ThrottleState | null, now: number, policy: LockoutPolicy = ADDRESS_POLICY): ThrottleState {
  const base = state ?? EMPTY;
  const fresh = !state || now - base.windowStartedAt > policy.window;
  const failures = (fresh ? 0 : base.failures) + 1;
  let lockouts = base.lockouts;
  let lockedUntil = base.lockedUntil && base.lockedUntil > now ? base.lockedUntil : null;
  if (failures >= policy.maxFailures) {
    lockedUntil = now + Math.min(policy.maxLock, policy.firstLock * 2 ** lockouts);
    lockouts += 1;
  }
  return { ...base, failures, windowStartedAt: fresh ? now : base.windowStartedAt, lockedUntil, lockouts };
}

/** Tries left from this address before its next lockout (never below zero). */
export function triesLeft(state: ThrottleState | null, now: number, policy: LockoutPolicy = ADDRESS_POLICY): number {
  if (!state || now - state.windowStartedAt > policy.window) return policy.maxFailures;
  return Math.max(0, policy.maxFailures - state.failures);
}

/** The plan's state after one more wrong password from anywhere: counts only, a new window forgets the alert. */
export function countFailure(state: ThrottleState | null, now: number, policy: AlertPolicy = PLAN_ALERT): ThrottleState {
  const base = state ?? EMPTY;
  const fresh = !state || now - base.windowStartedAt > policy.window;
  return {
    ...base,
    failures: (fresh ? 0 : base.failures) + 1,
    windowStartedAt: fresh ? now : base.windowStartedAt,
    lockedUntil: null,
    alertedAt: fresh ? null : base.alertedAt,
  };
}

/** True exactly once per window: when the count reaches the threshold and nobody has been told yet. */
export function shouldAlert(state: ThrottleState, policy: AlertPolicy = PLAN_ALERT): boolean {
  return state.failures >= policy.threshold && state.alertedAt === null;
}

/** Throttle scopes: the plan as a whole, and one hashed address within it. */
export function planScope(planId: string): string {
  return `plan:${planId}`;
}

export function addressScope(planId: string, addressHash: string): string {
  return `ip:${planId}:${addressHash}`;
}
