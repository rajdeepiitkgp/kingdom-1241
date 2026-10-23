import { describe, expect, it } from "vitest";
import type { KvkFormation } from "@/lib/data/types";
import { availableFilters, filterFormations, formationSummary, isValidRatio, openSlots, ratioLabel, sortFormations } from "@/lib/kvk/formations";

function formation(overrides: Partial<KvkFormation>): KvkFormation {
  return {
    id: "f",
    planId: "p",
    label: "A",
    side: "any",
    role: "any",
    heroSlugs: ["amane", null, null],
    infantry: 50,
    cavalry: 15,
    archers: 35,
    note: {},
    sortOrder: 0,
    published: true,
    ...overrides,
  };
}

describe("isValidRatio", () => {
  it("accepts whole percentages that add up to 100", () => {
    expect(isValidRatio({ infantry: 50, cavalry: 15, archers: 35 })).toBe(true);
    expect(isValidRatio({ infantry: 100, cavalry: 0, archers: 0 })).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidRatio({ infantry: 50, cavalry: 15, archers: 30 })).toBe(false);
    expect(isValidRatio({ infantry: 50.5, cavalry: 14.5, archers: 35 })).toBe(false);
    expect(isValidRatio({ infantry: 110, cavalry: -10, archers: 0 })).toBe(false);
  });
});

describe("filters", () => {
  const list = [
    formation({ id: "1", label: "A", side: "attack", role: "rally_lead" }),
    formation({ id: "2", label: "B", side: "attack", role: "rally_join" }),
    formation({ id: "3", label: "C", side: "defense" }),
  ];

  it("filters by side and by role", () => {
    expect(filterFormations(list, "attack").map((f) => f.id)).toEqual(["1", "2"]);
    expect(filterFormations(list, "defense").map((f) => f.id)).toEqual(["3"]);
    expect(filterFormations(list, "rally_join").map((f) => f.id)).toEqual(["2"]);
    expect(filterFormations(list, "all")).toHaveLength(3);
  });

  it("only offers the filters that are actually used", () => {
    expect(availableFilters(list)).toEqual(["all", "attack", "defense", "rally_lead", "rally_join"]);
    expect(availableFilters([formation({})])).toEqual(["all"]);
    expect(availableFilters([formation({ side: "defense" })])).toEqual(["all", "defense"]);
  });
});

describe("presentation helpers", () => {
  it("sorts by sort order then label", () => {
    const sorted = sortFormations([
      formation({ id: "c", label: "C", sortOrder: 1 }),
      formation({ id: "b", label: "B", sortOrder: 1 }),
      formation({ id: "z", label: "Z", sortOrder: 0 }),
    ]);
    expect(sorted.map((f) => f.id)).toEqual(["z", "b", "c"]);
  });

  it("formats the ratio and counts open slots", () => {
    expect(ratioLabel({ infantry: 60, cavalry: 0, archers: 40 })).toBe("60 / 0 / 40");
    expect(openSlots({ heroSlugs: ["amane", null, null] })).toBe(2);
    expect(openSlots({ heroSlugs: ["amane", "zoe", "eric"] })).toBe(0);
  });

  it("builds the chat summary line", () => {
    const text = formationSummary(formation({}), ["Amane"], {
      troops: { infantry: "Infantry", cavalry: "Cavalry", archers: "Archers" },
      otherHeroes: (n) => `${n} other heroes`,
    });
    expect(text).toBe("A) Amane + 2 other heroes — Infantry 50% / Cavalry 15% / Archers 35%");
  });
});
