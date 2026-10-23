import { describe, expect, it } from "vitest";
import { mapHero, mapKvkFormation, mapKvkPlan } from "@/lib/data/mappers";

describe("mapHero", () => {
  it("maps a row and falls back on bad enum values", () => {
    const hero = mapHero({ id: "1", slug: "amane", name: { en: "Amane", ar: "أماني" }, troop_type: "archers", rarity: "epic", generation: 1, icon_url: "/heroes/amane.png", sort_order: 3 });
    expect(hero).toMatchObject({ slug: "amane", troopType: "archers", rarity: "epic", generation: 1, iconUrl: "/heroes/amane.png", sortOrder: 3, published: true });
    expect(hero.name.ar).toBe("أماني");

    const odd = mapHero({ id: "2", slug: "x", name: "Plain string", troop_type: "dragons", rarity: "mythic", icon_url: "" });
    expect(odd.troopType).toBe("infantry");
    expect(odd.rarity).toBe("legendary");
    expect(odd.iconUrl).toBeNull();
    expect(odd.name).toEqual({ en: "Plain string" });
  });
});

describe("mapKvkFormation", () => {
  it("turns the three hero columns into slots and clamps percentages", () => {
    const f = mapKvkFormation({ id: "f", plan_id: "p", label: "A", side: "attack", role: "nonsense", hero_1: "amane", hero_2: "", hero_3: null, infantry_pct: "50", cavalry_pct: 15.4, archers_pct: 140 });
    expect(f.heroSlugs).toEqual(["amane", null, null]);
    expect(f.side).toBe("attack");
    expect(f.role).toBe("any");
    expect([f.infantry, f.cavalry, f.archers]).toEqual([50, 15, 100]);
  });
});

describe("mapKvkPlan", () => {
  const plan = { id: "p1", slug: "oct", title: { en: "Castle Battle" }, intro: { en: "<p>Hi</p>" }, password: "secret", active: true, min_hero_stars: 4, min_skill_level: 9, updated_at: "2026-10-23T10:00:00Z", battle_at: "2026-10-25T14:00:00Z" };

  it("attaches only the children of this plan, published ones, in order", () => {
    const rules = [
      { id: "r2", plan_id: "p1", kind: "do", text: { en: "Second" }, sort_order: 2 },
      { id: "r1", plan_id: "p1", kind: "dont", text: { en: "First" }, sort_order: 1 },
      { id: "rx", plan_id: "other", kind: "do", text: { en: "Other plan" }, sort_order: 0 },
      { id: "rh", plan_id: "p1", kind: "info", text: { en: "Hidden" }, sort_order: 0, published: false },
    ];
    const formations = [
      { id: "fB", plan_id: "p1", label: "B", sort_order: 1, infantry_pct: 60, cavalry_pct: 40, archers_pct: 0 },
      { id: "fA", plan_id: "p1", label: "A", sort_order: 0, infantry_pct: 50, cavalry_pct: 15, archers_pct: 35 },
    ];
    const mapped = mapKvkPlan(plan, rules, [], formations);
    expect(mapped.rules.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(mapped.formations.map((f) => f.label)).toEqual(["A", "B"]);
    expect(mapped.coordinators).toEqual([]);
    expect(mapped.password).toBe("secret");
    expect(mapped.battleAt).toBe("2026-10-25T14:00:00.000Z");
    expect(mapped.minSkillLevel).toBe(5); // clamped to the 0–5 range
    expect(mapped.minHeroStars).toBe(4);
    expect(mapped.eventType).toBe("kvk"); // default when the column is missing
    expect(mapKvkPlan({ ...plan, event_type: "castle_battle" }, [], [], []).eventType).toBe("castle_battle");
  });

  it("tolerates a half-filled row", () => {
    const mapped = mapKvkPlan({ id: "p2" }, [], [], []);
    expect(mapped.title).toEqual({});
    expect(mapped.battleAt).toBeNull();
    expect(mapped.opponent).toBeNull();
    expect(mapped.password).toBe("");
    expect(mapped.minHeroStars).toBe(4);
    expect(mapped.minSkillLevel).toBe(5);
  });
});
