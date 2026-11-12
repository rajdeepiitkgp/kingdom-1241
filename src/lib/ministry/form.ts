// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { isLocaleCode } from "@/lib/i18n/languages";
import type { Buff, ScoringDay } from "@/lib/kvk/prep";
import { GAME_NAME_MAX } from "@/lib/retro/config";
import { isGovernorId, NO_ALLIANCE, normalizeGovernorId } from "@/lib/retro/form";
import { AMOUNT_MAX, type Amounts, BUFF_FIELDS, cleanSlots, NO_AMOUNTS, type ResourceField, type Section, sectionScore, type SlotChoice, SPEEDUP_DAYS_MAX, speedupMinutes } from "./ministry";

/**
 * Parsing of a ministry sign-up (pure, unit-tested): the player's form and
 * the moderators' edit form post the same fields. Errors are codes, not
 * sentences: the player's form shows them in their language.
 */

/** `lateTaken`: the free appointments in the times picked went to someone else a moment ago. */
export type SignupErrorCode = "required" | "invalid" | "tooLong" | "tooMuch" | "noSlots" | "noAmount" | "lateTaken";
export type SignupErrors = Record<string, SignupErrorCode>;

/** Field names of the form. */
export const FIELD = {
  round: "round",
  governorId: "governorId",
  gameName: "gameName",
  alliance: "alliance",
  locale: "locale",
  token: "token",
  /** The device's own key: whoever holds it may change the entry later. */
  deviceKey: "deviceKey",
  /** Honeypot: hidden from people, filled by bots. */
  honeypot: "website",
  /** "on" when the player takes part in the section of that day. */
  join: (day: ScoringDay) => `join.${day}`,
  /** One value per ticked button of the picker: its half-hour slots, comma-separated. */
  slots: (day: ScoringDay) => `slots.${day}`,
  days: (buff: Buff) => `${buff}.days`,
  hours: (buff: Buff) => `${buff}.hours`,
  /** The form-level error "pick at least one day". */
  sections: "sections",
} as const;

export interface SignupSubmission {
  governorId: string;
  gameName: string;
  /** `null` = other / no alliance. */
  allianceTag: string | null;
  amounts: Amounts;
  slots: SlotChoice;
  locale: string;
  /** The days past their deadline the player joins now, for one of the free appointments. */
  lateDays: ScoringDay[];
}

type Form = { get(name: string): unknown; getAll(name: string): unknown[] };

function text(form: Form, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** A whole number from 0 to `max`; empty counts as 0. */
function count(form: Form, name: string, max: number, errors: SignupErrors): number {
  const raw = text(form, name).replace(/[\s,.'_]/g, "");
  if (!raw) return 0;
  if (!/^\d{1,12}$/.test(raw)) {
    errors[name] = "invalid";
    return 0;
  }
  const n = Number(raw);
  if (n > max) {
    errors[name] = "tooMuch";
    return 0;
  }
  return n;
}

/** The slots ticked for a day: every value is a comma-separated list of half-hour slots. */
export function postedSlots(form: Form, day: ScoringDay): number[] {
  const values = form.getAll(FIELD.slots(day)).flatMap((value) => (typeof value === "string" ? value.split(",") : []));
  return cleanSlots(values.filter((value) => /^\d{1,2}$/.test(value.trim())).map((value) => Number(value)));
}

export interface ParseSignupOptions {
  /** Name and alliance confirmed through MightPulse: the form's own values are ignored. */
  verified?: { name: string; allianceTag: string | null } | null;
  /** The buff days of the round. */
  sections: readonly Section[];
  /** The days that can still be changed; the others keep what `existing` holds. */
  openDays: readonly ScoringDay[];
  /**
   * Days past their deadline that still have free appointments this player may take: joined in the form, such a day is
   * read like an open one (what they bring, the times picked); left alone, it keeps what was stored.
   */
  lateDays?: readonly ScoringDay[];
  /** The stored entry when this is a change. */
  existing?: { amounts: Amounts; slots: SlotChoice } | null;
}

export type SignupFormResult = { ok: true; value: SignupSubmission } | { ok: false; errors: SignupErrors };

export function parseSignupForm(form: Form, allianceTags: readonly string[], options: ParseSignupOptions): SignupFormResult {
  const errors: SignupErrors = {};

  const governorId = normalizeGovernorId(text(form, FIELD.governorId));
  if (!governorId) errors[FIELD.governorId] = "required";
  else if (!isGovernorId(governorId)) errors[FIELD.governorId] = "invalid";

  let gameName: string;
  let allianceTag: string | null;
  const chosen = text(form, FIELD.alliance);
  if (options.verified) {
    gameName = options.verified.name.slice(0, GAME_NAME_MAX);
    const known = options.verified.allianceTag && allianceTags.includes(options.verified.allianceTag) ? options.verified.allianceTag : null;
    // An alliance the site doesn't list (a battle alliance, a new one): the player's own choice counts, if it is a listed one.
    allianceTag = known ?? (chosen && chosen !== NO_ALLIANCE && allianceTags.includes(chosen) ? chosen : null);
  } else {
    gameName = text(form, FIELD.gameName);
    if (!gameName) errors[FIELD.gameName] = "required";
    else if (gameName.length > GAME_NAME_MAX) errors[FIELD.gameName] = "tooLong";
    if (!chosen) errors[FIELD.alliance] = "required";
    else if (chosen !== NO_ALLIANCE && !allianceTags.includes(chosen)) errors[FIELD.alliance] = "invalid";
    allianceTag = chosen === NO_ALLIANCE ? null : chosen;
  }

  const amounts: Amounts = { ...NO_AMOUNTS };
  const slots: SlotChoice = {};
  const lateDays: ScoringDay[] = [];
  for (const section of options.sections) {
    const fields = section.buffs.flatMap((buff) => [...BUFF_FIELDS[buff].resources, BUFF_FIELDS[buff].speedups]);
    const late = !options.openDays.includes(section.day) && Boolean(options.lateDays?.includes(section.day)) && text(form, FIELD.join(section.day)) === "on";
    if (!options.openDays.includes(section.day) && !late) {
      // Past its deadline: what was stored stays, whatever the form says.
      const kept = options.existing?.slots[section.day];
      if (kept && kept.length > 0) slots[section.day] = kept;
      for (const field of fields) amounts[field] = options.existing?.amounts[field] ?? 0;
      continue;
    }
    if (text(form, FIELD.join(section.day)) !== "on") continue;
    for (const buff of section.buffs) {
      for (const resource of BUFF_FIELDS[buff].resources) amounts[resource] = count(form, resource, AMOUNT_MAX[resource as ResourceField], errors);
      const days = count(form, FIELD.days(buff), SPEEDUP_DAYS_MAX, errors);
      const hours = count(form, FIELD.hours(buff), 23, errors);
      amounts[BUFF_FIELDS[buff].speedups] = speedupMinutes(days, hours);
    }
    const picked = postedSlots(form, section.day);
    if (picked.length === 0) errors[FIELD.slots(section.day)] = "noSlots";
    else slots[section.day] = picked;
    if (late) lateDays.push(section.day);
    const fieldError = fields.some((field) => field in errors) || section.buffs.some((buff) => FIELD.days(buff) in errors || FIELD.hours(buff) in errors);
    if (!fieldError && sectionScore(section, amounts) === 0) errors[FIELD.join(section.day)] = "noAmount";
  }
  if (Object.keys(slots).length === 0 && !options.sections.some((section) => FIELD.slots(section.day) in errors)) errors[FIELD.sections] = "required";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const locale = text(form, FIELD.locale);
  return { ok: true, value: { governorId, gameName, allianceTag, amounts, slots, locale: isLocaleCode(locale) ? locale : "en", lateDays } };
}

/** A device key as the form sends it: 32 to 64 hex characters, made by the browser. */
export function isDeviceKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32,64}$/.test(value);
}
