import { describe, expect, it } from "vitest";
import { ADDRESS_POLICY, addressScope, addressScopePrefix, countFailure, PLAN_ALERT, planScope, recordFailure, retryAfter, shouldAlert, triesLeft, type ThrottleState } from "@/lib/kvk/throttle";
import { HOUR, MINUTE } from "@/lib/time";

function fail(times: number, start: number, gap = 1000): ThrottleState {
  let state: ThrottleState | null = null;
  for (let i = 0; i < times; i++) state = recordFailure(state, start + i * gap, ADDRESS_POLICY);
  return state as ThrottleState;
}

const t0 = Date.parse("2026-11-01T10:00:00Z");

describe("address lockout", () => {
  it("allows four wrong tries and locks on the fifth for an hour", () => {
    const four = fail(4, t0);
    expect(retryAfter(four, t0 + 5000)).toBe(0);
    expect(triesLeft(four, t0 + 5000)).toBe(1);
    const five = recordFailure(four, t0 + 5000);
    expect(retryAfter(five, t0 + 5000)).toBe(HOUR);
    expect(retryAfter(five, t0 + 5000 + HOUR)).toBe(0);
    expect(triesLeft(null, t0)).toBe(5);
  });

  it("doubles every further lockout up to a day, even when the window has long expired", () => {
    const once = { ...fail(4, t0), lockouts: 1 };
    expect(retryAfter(recordFailure(once, t0 + 4000), t0 + 4000)).toBe(2 * HOUR);
    const often = { ...fail(4, t0), lockouts: 10 };
    expect(retryAfter(recordFailure(often, t0 + 4000), t0 + 4000)).toBe(24 * HOUR);
  });

  it("starts a new window after 15 quiet minutes but keeps the lockout count", () => {
    const next = recordFailure({ ...fail(3, t0), lockouts: 2 }, t0 + 16 * MINUTE);
    expect(next).toMatchObject({ failures: 1, lockouts: 2, lockedUntil: null });
  });
});

describe("plan-wide detection", () => {
  it("never locks anyone out, and asks for one alert when the hourly threshold is reached", () => {
    let state: ThrottleState | null = null;
    for (let i = 0; i < PLAN_ALERT.threshold - 1; i++) {
      state = countFailure(state, t0 + i * 1000);
      expect(shouldAlert(state)).toBe(false);
    }
    const hit = countFailure(state, t0 + 60_000);
    expect(retryAfter(hit, t0 + 60_000)).toBe(0);
    expect(shouldAlert(hit)).toBe(true);
    const told = { ...hit, alertedAt: t0 + 60_000 };
    expect(shouldAlert(countFailure(told, t0 + 61_000))).toBe(false);
  });

  it("forgets the count and the alert after a quiet hour", () => {
    const hot: ThrottleState = { failures: 40, windowStartedAt: t0, lockedUntil: null, lockouts: 0, alertedAt: t0 + 1 };
    expect(countFailure(hot, t0 + 2 * HOUR)).toMatchObject({ failures: 1, alertedAt: null });
  });
});

describe("scopes", () => {
  it("name the plan and the hashed address", () => {
    expect(planScope("p1")).toBe("plan:p1");
    expect(addressScope("p1", "abcd")).toBe("ip:p1:abcd");
  });

  it("keep the leader page's guesses apart from the battle plan's", () => {
    expect(planScope("p1", "leaders")).toBe("plan:leaders:p1");
    expect(addressScope("p1", "abcd", "leaders")).toBe("ip:leaders:p1:abcd");
    // The plan's alert counts addresses by prefix; a leader-page scope must not match it.
    expect(addressScope("p1", "abcd", "leaders").startsWith(addressScopePrefix("p1"))).toBe(false);
    expect(addressScope("p1", "abcd", "leaders").startsWith(addressScopePrefix("p1", "leaders"))).toBe(true);
  });
});
