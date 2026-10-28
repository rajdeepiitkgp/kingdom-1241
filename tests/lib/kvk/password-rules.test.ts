import { describe, expect, it } from "vitest";
import { DEFAULT_PASSWORD_RULES, parsePasswordRules, parsePasswordRulesForm, passwordPolicies } from "@/lib/kvk/password-rules";
import { ADDRESS_POLICY, PLAN_ALERT } from "@/lib/kvk/throttle";

const form = (values: Record<string, number>) => ({ get: (name: string) => (name in values ? String(values[name]) : null) });

describe("the owner's wrong-password rules", () => {
  it("default to the rules the site was built with", () => {
    expect(passwordPolicies(DEFAULT_PASSWORD_RULES)).toEqual({ address: ADDRESS_POLICY, alert: PLAN_ALERT });
    expect(parsePasswordRules(undefined)).toEqual(DEFAULT_PASSWORD_RULES);
  });

  it("turn the owner's numbers into the throttle's policies", () => {
    const policies = passwordPolicies({ tries: 3, windowMinutes: 10, firstLockMinutes: 30, maxLockHours: 6, alertTries: 50 });
    expect(policies.address).toEqual({ window: 10 * 60_000, maxFailures: 3, firstLock: 30 * 60_000, maxLock: 6 * 3_600_000 });
    expect(policies.alert).toEqual({ window: 3_600_000, threshold: 50 });
    // A stored longest lockout shorter than the first one never shortens it.
    expect(passwordPolicies({ ...DEFAULT_PASSWORD_RULES, firstLockMinutes: 180, maxLockHours: 1 }).address.maxLock).toBe(180 * 60_000);
  });

  it("refuse a longest lockout shorter than the first", () => {
    expect(parsePasswordRulesForm(form({ ...DEFAULT_PASSWORD_RULES, firstLockMinutes: 180, maxLockHours: 2 }))).toEqual({
      ok: false,
      errors: { maxLockHours: "At least as long as the first lockout." },
    });
    expect(parsePasswordRulesForm(form({ ...DEFAULT_PASSWORD_RULES, firstLockMinutes: 120, maxLockHours: 2 }))).toEqual({
      ok: true,
      value: { ...DEFAULT_PASSWORD_RULES, firstLockMinutes: 120, maxLockHours: 2 },
    });
    expect(parsePasswordRulesForm(form({ ...DEFAULT_PASSWORD_RULES, tries: 1 }))).toMatchObject({ ok: false, errors: { tries: "3 to 20." } });
  });
});
