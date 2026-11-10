// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { FIELD, isDeviceKey, parseSignupForm, postedSlots } from "@/lib/ministry/form";
import { NO_AMOUNTS, sectionsFor } from "@/lib/ministry/ministry";

const SECTIONS = sectionsFor({ construction: 1, research: 2 });
const TAGS = ["NAM", "Nam"];

function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) for (const item of Array.isArray(value) ? value : [value]) data.append(name, item);
  return data;
}

const BASE = { [FIELD.governorId]: "12 345 678", [FIELD.gameName]: "Rudy", [FIELD.alliance]: "NAM", [FIELD.locale]: "de" };
const parse = (fields: Record<string, string | string[]>, options: Partial<Parameters<typeof parseSignupForm>[2]> = {}) =>
  parseSignupForm(form({ ...BASE, ...fields }), TAGS, { sections: SECTIONS, openDays: [1, 2, 4], ...options });

describe("parseSignupForm", () => {
  it("takes the days the player joins, with their amounts and slots", () => {
    const result = parse({ "join.1": "on", truegold: "1,200", temperedTruegold: "30", "construction.days": "4", "construction.hours": "6", "slots.1": ["0,1,2,3", "20,21,22,23"], "join.4": "on", "training.days": "10", "slots.4": "8,9" });
    expect(result).toEqual({
      ok: true,
      value: {
        governorId: "12345678",
        gameName: "Rudy",
        allianceTag: "NAM",
        amounts: { ...NO_AMOUNTS, truegold: 1200, temperedTruegold: 30, constructionMinutes: 4 * 1440 + 360, trainingMinutes: 14_400 },
        slots: { 1: [0, 1, 2, 3, 20, 21, 22, 23], 4: [8, 9] },
        locale: "de",
      },
    });
  });

  it("ignores what is typed for a day the player sits out", () => {
    const result = parse({ "join.4": "on", "training.days": "1", "slots.4": "8", tgDust: "9999", "slots.2": "1,2" });
    expect(result.ok && result.value.amounts.tgDust).toBe(0);
    expect(result.ok && result.value.slots).toEqual({ 4: [8] });
  });

  it("wants a time and an amount for every joined day, and at least one day", () => {
    const noSlots = parse({ "join.1": "on", truegold: "5" });
    expect(!noSlots.ok && noSlots.errors).toEqual({ "slots.1": "noSlots" });
    const noAmount = parse({ "join.2": "on", "slots.2": "4" });
    expect(!noAmount.ok && noAmount.errors).toEqual({ "join.2": "noAmount" });
    const nothing = parse({});
    expect(!nothing.ok && nothing.errors).toEqual({ sections: "required" });
  });

  it("refuses numbers that aren't whole or are far too large", () => {
    const result = parse({ "join.1": "on", truegold: "12a", temperedTruegold: "999999999", "construction.hours": "24", "slots.1": "1" });
    expect(!result.ok && result.errors).toEqual({ truegold: "invalid", temperedTruegold: "tooMuch", "construction.hours": "tooMuch" });
  });

  it("checks the account fields", () => {
    const result = parse({ [FIELD.governorId]: "12", [FIELD.gameName]: "", [FIELD.alliance]: "nam", "join.4": "on", "training.hours": "5", "slots.4": "1" });
    expect(!result.ok && result.errors).toEqual({ governorId: "invalid", gameName: "required", alliance: "invalid" });
  });

  it("a verified name and alliance replace what the form says; tags stay case-sensitive", () => {
    const result = parse({ [FIELD.gameName]: "Someone else", [FIELD.alliance]: "NAM", "join.4": "on", "training.hours": "5", "slots.4": "1" }, { verified: { name: "Rudy the Real", allianceTag: "Nam" } });
    expect(result.ok && [result.value.gameName, result.value.allianceTag]).toEqual(["Rudy the Real", "Nam"]);
    // An alliance the site doesn't list ([KvK] on battle week): the player's pick counts.
    const battle = parse({ [FIELD.alliance]: "NAM", "join.4": "on", "training.hours": "5", "slots.4": "1" }, { verified: { name: "Rudy", allianceTag: "KvK" } });
    expect(battle.ok && battle.value.allianceTag).toBe("NAM");
  });

  it("a day past its deadline keeps what was stored, whatever the form says", () => {
    const existing = { amounts: { ...NO_AMOUNTS, truegold: 700, constructionMinutes: 60, tgDust: 5 }, slots: { 1: [4, 5], 2: [9] } };
    const result = parse({ "join.1": "on", truegold: "999999", "slots.1": "40", "join.2": "on", tgDust: "80", "slots.2": "10,11" }, { openDays: [2, 4], existing });
    expect(result.ok && result.value.amounts).toEqual({ ...NO_AMOUNTS, truegold: 700, constructionMinutes: 60, tgDust: 80 });
    expect(result.ok && result.value.slots).toEqual({ 1: [4, 5], 2: [10, 11] });
    // Without a stored entry, a closed day can't be joined at all.
    const fresh = parse({ "join.1": "on", truegold: "5", "slots.1": "40" }, { openDays: [2, 4] });
    expect(!fresh.ok && fresh.errors).toEqual({ sections: "required" });
  });

  it("a shared construction and research day is one section", () => {
    const result = parseSignupForm(form({ ...BASE, "join.2": "on", truegold: "1", tgDust: "2", "research.days": "1", "slots.2": "0,1" }), TAGS, { sections: sectionsFor({ construction: 2, research: 2 }), openDays: [2, 4] });
    expect(result.ok && result.value.amounts).toEqual({ ...NO_AMOUNTS, truegold: 1, tgDust: 2, researchMinutes: 1440 });
  });
});

describe("posted slots and device keys", () => {
  it("reads the picker's values as half-hour slots", () => {
    expect(postedSlots(form({ "slots.1": ["4,5,6,7", "0", "48,x,-1"] }), 1)).toEqual([0, 4, 5, 6, 7]);
    expect(postedSlots(form({}), 1)).toEqual([]);
  });

  it("a device key is 32 to 64 hex characters", () => {
    expect(isDeviceKey("a".repeat(32))).toBe(true);
    expect(isDeviceKey("a".repeat(31))).toBe(false);
    expect(isDeviceKey("G".repeat(32))).toBe(false);
    expect(isDeviceKey(null)).toBe(false);
  });
});
