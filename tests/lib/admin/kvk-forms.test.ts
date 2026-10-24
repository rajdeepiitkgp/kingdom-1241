import { describe, expect, it } from "vitest";
import {
  moveInList,
  nextFreeLabel,
  parseCoordinatorForm,
  parseFormationForm,
  parsePlanForm,
  parseRuleForm,
} from "@/lib/admin/kvk-forms";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parsePlanForm", () => {
  const valid = {
    title: "Castle Battle — 1 Nov",
    eventType: "castle_battle",
    password: "secret",
    battleAt: "2026-11-01T14:00",
    minHeroStars: "4",
    minSkillLevel: "5",
    introSource: "Hi all!",
    active: "on",
  };

  it("accepts a complete plan and derives the slug", () => {
    const result = parsePlanForm(form(valid));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("castle-battle-1-nov");
    expect(result.value.battleAt).toBe("2026-11-01T14:00:00.000Z");
    expect(result.value.active).toBe(true);
    expect(result.value.published).toBe(false);
    expect(result.value.opponent).toBeNull();
  });

  it("reports every invalid field at once", () => {
    const result = parsePlanForm(form({ ...valid, title: "", password: "ab", battleAt: "soon", minHeroStars: "7" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["battleAt", "minHeroStars", "password", "slug", "title"]);
  });
});

describe("parseRuleForm", () => {
  it("needs text and defaults the kind", () => {
    expect(parseRuleForm(form({ text: "" })).ok).toBe(false);
    const result = parseRuleForm(form({ text: "No buffs", kind: "dont", published: "on" }));
    expect(result).toEqual({ ok: true, value: { kind: "dont", text: "No buffs", published: true } });
  });

  it("never takes an order from the form (rows are moved with the arrows)", () => {
    const result = parseRuleForm(form({ text: "x", sortOrder: "3" }));
    expect(result.ok && "sortOrder" in result.value).toBe(false);
  });
});

describe("parseCoordinatorForm", () => {
  it("checks the alliance against the kingdom's list", () => {
    const tags = ["NAM", "ULU"];
    expect(parseCoordinatorForm(form({ name: "Cleo", allianceTag: "XYZ" }), tags).ok).toBe(false);
    const result = parseCoordinatorForm(form({ name: "Cleo", team: "tmp", allianceTag: "ULU", note: "English" }), tags);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ team: "tmp", allianceTag: "ULU", note: "English" });
  });
});

describe("parseFormationForm", () => {
  const heroes = ["amane", "chenko", "hilde"];
  const valid = { label: "a", side: "attack", role: "any", hero1: "amane", infantry: "50", cavalry: "15", archers: "35" };

  it("accepts a valid formation and upper-cases the label", () => {
    const result = parseFormationForm(form(valid), heroes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toBe("A");
    expect(result.value.heroes).toEqual(["amane", null, null]);
  });

  it("rejects ratios that do not add up, unknown heroes and duplicates", () => {
    const bad = parseFormationForm(form({ ...valid, archers: "40" }), heroes);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.ratio).toContain("105");

    const unknown = parseFormationForm(form({ ...valid, hero2: "nobody" }), heroes);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.hero2).toBeDefined();

    const twice = parseFormationForm(form({ ...valid, hero2: "amane" }), heroes);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.errors.heroes).toBeDefined();

    const badLabel = parseFormationForm(form({ ...valid, label: "M" }), heroes);
    expect(badLabel.ok).toBe(false);
  });
});

describe("nextFreeLabel", () => {
  it("finds the first unused preset letter", () => {
    expect(nextFreeLabel([])).toBe("A");
    expect(nextFreeLabel(["A", "b", "C"])).toBe("D");
    expect(nextFreeLabel([..."ABCDEFGHIJKL"])).toBeNull();
  });
});

describe("moveInList", () => {
  const ids = ["a", "b", "c"];

  it("swaps a row with its neighbour", () => {
    expect(moveInList(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInList(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the ends or for an unknown row", () => {
    expect(moveInList(ids, "a", "up")).toBeNull();
    expect(moveInList(ids, "c", "down")).toBeNull();
    expect(moveInList(ids, "zz", "up")).toBeNull();
    expect(ids).toEqual(["a", "b", "c"]);
  });
});
