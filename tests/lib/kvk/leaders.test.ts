import { describe, expect, it } from "vitest";
import type { KvkLeaderRule, KvkRallyLeader } from "@/lib/data/types";
import { latestPetsOffset, offsetLabel, PET_BOOST_MINUTES, petsMoment, petsWindow, ralliesByTeam, rulesByAudience } from "@/lib/kvk/leaders";

function rally(id: string, team: "kvk" | "tmp"): KvkRallyLeader {
  return {
    id,
    planId: "p",
    target: {},
    side: "attack",
    team,
    name: id,
    allianceTag: null,
    position: {},
    startAt: null,
    petsOffsetMinutes: null,
    heroSlugs: [null, null, null],
    infantry: 50,
    cavalry: 0,
    archers: 50,
    note: {},
    sortOrder: 0,
    published: true,
  };
}

function rule(id: string, audience: KvkLeaderRule["audience"]): KvkLeaderRule {
  return { id, planId: "p", audience, kind: "do", text: {}, sortOrder: 0, published: true };
}

describe("ralliesByTeam", () => {
  it("groups by battle team, [KvK] first, numbering in the council's order", () => {
    const groups = ralliesByTeam([rally("a", "tmp"), rally("b", "kvk"), rally("c", "kvk")]);
    expect(groups.map((g) => [g.team, g.rallies.map((r) => `${r.rally.id}${r.number}`)])).toEqual([
      ["kvk", ["b2", "c3"]],
      ["tmp", ["a1"]],
    ]);
  });
  it("leaves out empty teams", () => {
    expect(ralliesByTeam([rally("a", "kvk")]).map((g) => g.team)).toEqual(["kvk"]);
    expect(ralliesByTeam([])).toEqual([]);
  });
});

describe("rulesByAudience", () => {
  it("orders every leader, rally leads, garrison leads and skips empty groups", () => {
    const groups = rulesByAudience([rule("g", "garrison"), rule("a", "all"), rule("a2", "all")]);
    expect(groups.map((g) => [g.audience, g.rules.map((r) => r.id)])).toEqual([
      ["all", ["a", "a2"]],
      ["garrison", ["g"]],
    ]);
  });
});

describe("petsMoment", () => {
  it("adds the offset to the battle start", () => {
    expect(petsMoment("2026-11-01T14:00:00Z", 120)?.toISOString()).toBe("2026-11-01T16:00:00.000Z");
    expect(petsMoment("2026-11-01T14:00:00Z", 0)?.toISOString()).toBe("2026-11-01T14:00:00.000Z");
  });
  it("is null without pets or without a battle time", () => {
    expect(petsMoment("2026-11-01T14:00:00Z", null)).toBeNull();
    expect(petsMoment(null, 30)).toBeNull();
    expect(petsMoment("not a date", 30)).toBeNull();
  });
});

describe("offsetLabel", () => {
  const units = { hours: "hrs", minutes: "min" };
  it("reads hours and minutes", () => {
    expect(offsetLabel(120, units)).toBe("2 hrs");
    expect(offsetLabel(90, units)).toBe("1 hrs 30 min");
    expect(offsetLabel(45, units)).toBe("45 min");
  });
});

describe("pets boost", () => {
  it("lasts two hours from activation", () => {
    expect(PET_BOOST_MINUTES).toBe(120);
    const window = petsWindow("2026-11-01T12:00:00Z", 240);
    expect(window?.from.toISOString()).toBe("2026-11-01T16:00:00.000Z");
    expect(window?.to.toISOString()).toBe("2026-11-01T18:00:00.000Z");
    expect(petsWindow(null, 0)).toBeNull();
  });
  it("must start early enough to end inside the battle", () => {
    expect(latestPetsOffset(420)).toBe(300); // 12:00–19:00 → last activation at 17:00
    expect(latestPetsOffset(60)).toBe(0);
  });
});
