import { type NumberSchema, numberDefaults, parseNumberForm, parseNumbers } from "@/lib/config/numbers";
import { HOUR, MINUTE } from "@/lib/time";
import type { AlertPolicy, LockoutPolicy } from "./throttle";

/**
 * The owner's wrong-password rules (pure, unit-tested; stored in app_config
 * "password_rules"), for the battle plan, leader and checklist pages and the
 * Rally Sync rooms. The defaults are the rules the site was built with:
 * ADDRESS_POLICY and PLAN_ALERT in throttle.ts.
 */

export type PasswordRuleKey = "tries" | "windowMinutes" | "firstLockMinutes" | "maxLockHours" | "alertTries";
export type PasswordRules = Record<PasswordRuleKey, number>;

export const PASSWORD_RULES: NumberSchema<PasswordRuleKey> = {
  /** Wrong tries from one address within the window that lock it. */
  tries: { min: 3, max: 20, default: 5 },
  windowMinutes: { min: 5, max: 120, default: 15 },
  /** The first lockout; every further one doubles, up to the longest. */
  firstLockMinutes: { min: 5, max: 360, default: 60 },
  maxLockHours: { min: 1, max: 72, default: 24 },
  /** Wrong tries in an hour from every address together that alert the council (nobody is locked by this). */
  alertTries: { min: 10, max: 500, default: 30 },
};

export const DEFAULT_PASSWORD_RULES: PasswordRules = numberDefaults(PASSWORD_RULES);

export function parsePasswordRules(value: unknown): PasswordRules {
  return parseNumbers(PASSWORD_RULES, value);
}

/** The settings form: every number in range, and the longest lockout at least as long as the first. */
export function parsePasswordRulesForm(form: { get(name: string): unknown }): { ok: true; value: PasswordRules } | { ok: false; errors: Record<string, string> } {
  const parsed = parseNumberForm(PASSWORD_RULES, form);
  if (!parsed.ok) return parsed;
  if (parsed.value.maxLockHours * 60 < parsed.value.firstLockMinutes) return { ok: false, errors: { maxLockHours: "At least as long as the first lockout." } };
  return parsed;
}

export interface PasswordPolicies {
  address: LockoutPolicy;
  alert: AlertPolicy;
}

export function passwordPolicies(rules: PasswordRules): PasswordPolicies {
  const firstLock = rules.firstLockMinutes * MINUTE;
  return {
    address: { window: rules.windowMinutes * MINUTE, maxFailures: rules.tries, firstLock, maxLock: Math.max(firstLock, rules.maxLockHours * HOUR) },
    alert: { window: HOUR, threshold: rules.alertTries },
  };
}
