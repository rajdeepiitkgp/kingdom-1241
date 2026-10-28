import { describe, expect, it } from "vitest";
import {
  mapAlliance,
  mapAnnouncement,
  mapEvent,
  mapGiftCode,
  mapGuide,
  mapHero,
  mapKvkChecklistPlan,
  mapKvkFormation,
  mapKvkLeaderPlan,
  mapKvkPlan,
  mapRule,
  mapRuleTopic,
  mapSettings,
  settingsToRows,
} from "@/lib/data/mappers";
import { SEED_SETTINGS } from "@/content/seed/settings";

describe("settingsToRows", () => {
  it("never produces a null value (the column is jsonb not null) and round-trips through mapSettings", () => {
    const rows = settingsToRows({ ...SEED_SETTINGS, discordInviteUrl: null });
    expect(rows.every((r) => r.value !== null && r.value !== undefined)).toBe(true);
    expect(rows.find((r) => r.key === "discord_invite_url")).toBeUndefined();
    const back = mapSettings(rows, SEED_SETTINGS);
    expect(back).toEqual({ ...SEED_SETTINGS, discordInviteUrl: null });
    expect(settingsToRows({ ...SEED_SETTINGS, discordInviteUrl: "https://discord.gg/x" }).find((r) => r.key === "discord_invite_url")?.value).toBe("https://discord.gg/x");
  });
});

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
    expect(mapped.battleEndAt).toBeNull(); // optional
    expect(mapKvkPlan({ ...plan, battle_end_at: "2026-10-25T17:00:00Z" }, [], [], []).battleEndAt).toBe("2026-10-25T17:00:00.000Z");
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

describe("content mappers", () => {
  it("mapAnnouncement normalises dates and treats a missing published flag as published", () => {
    const a = mapAnnouncement({ id: "a1", title: { en: "Hi" }, body: "<p>Plain string body</p>", pinned: 1, published_at: "2026-10-01T10:00:00+02:00", expires_at: "not a date" });
    expect(a).toMatchObject({ id: "a1", pinned: true, published: true, publishedAt: "2026-10-01T08:00:00.000Z", expiresAt: null });
    expect(a.body).toEqual({ en: "<p>Plain string body</p>" });
    expect(mapAnnouncement({ id: "a2", published: false, expires_at: "2026-12-01T00:00:00Z" })).toMatchObject({ published: false, expiresAt: "2026-12-01T00:00:00.000Z", publishedAt: "1970-01-01T00:00:00.000Z" });
  });

  it("mapEvent keeps a sane event out of a half-filled row", () => {
    const e = mapEvent({ id: "e1", slug: "bear", name: { en: "Bear Hunt" }, category: "dragons", duration_minutes: "0", repeat_every_days: "2", guide_slug: "", starts_at: "2026-10-24T12:00:00Z" });
    expect(e).toMatchObject({ category: "alliance", icon: "📅", color: "sky", durationMinutes: 1, repeatEveryDays: 2, guideSlug: null, published: true, startsAt: "2026-10-24T12:00:00.000Z" });
    expect(mapEvent({ id: "e2", category: "solo", duration_minutes: 90, guide_slug: "kvk" })).toMatchObject({ category: "solo", durationMinutes: 90, repeatEveryDays: null, guideSlug: "kvk" });
  });

  it("mapRuleTopic attaches its own rules in order", () => {
    const rules = [
      { id: "r2", topic_id: "t1", title: { en: "Second" }, body: { en: "<p>2</p>" }, sort_order: 2 },
      { id: "r1", topic_id: "t1", title: { en: "First" }, body: { en: "<p>1</p>" }, sort_order: 1 },
      { id: "rx", topic_id: "t2", title: { en: "Other" }, body: { en: "<p>x</p>" }, sort_order: 0 },
    ].map(mapRule);
    const topic = mapRuleTopic({ id: "t1", slug: "general", title: { en: "General" } }, rules);
    expect(topic).toMatchObject({ slug: "general", icon: "📜", sortOrder: 0, published: true });
    expect(topic.rules.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(rules[0]).toMatchObject({ topicId: "t1", sortOrder: 2, published: true });
  });

  it("mapGuide, mapAlliance and mapGiftCode fill defaults for optional columns", () => {
    expect(mapGuide({ id: "g1", slug: "kvk", title: { en: "KvK" }, body: { en: "<p>b</p>" }, cover_image_url: "" })).toMatchObject({ icon: "📖", coverImageUrl: null, sortOrder: 0, published: true, updatedAt: "1970-01-01T00:00:00.000Z" });
    const alliance = mapAlliance({ id: "al1", tag: "ULU", name: "Ulu", power: "123", members: null, languages: "EN / DE" });
    expect(alliance).toMatchObject({ tag: "ULU", color: "#3b82f6", leader: null, power: 123, members: null, maxMembers: 100, languages: "EN / DE", discordUrl: null });
    expect(alliance.description).toEqual({});
    expect(mapGiftCode({ id: "c1", code: "KS2026", rewards: { en: "Gems" }, active: false, added_at: "2026-10-01T00:00:00Z" })).toMatchObject({
      code: "KS2026",
      active: false,
      expiresAt: null,
      addedAt: "2026-10-01T00:00:00.000Z",
      source: "manual",
      endedAt: null,
    });
    expect(mapGiftCode({ id: "c2", code: "X", expires_at: "2026-11-01T00:00:00Z", source: "kingshot", ended_at: "2026-10-30T10:23:00Z" })).toMatchObject({
      active: true,
      expiresAt: "2026-11-01T00:00:00.000Z",
      source: "kingshot",
      endedAt: "2026-10-30T10:23:00.000Z",
    });
  });
});

describe("mapKvkChecklistPlan", () => {
  const plan = { id: "p1", slug: "oct", title: { en: "Castle Battle" }, event_type: "kvk", battle_at: "2026-11-07T12:00:00Z", password: "plan-pw" };
  const brief = { id: "c1", plan_id: "p1", password: "boss-pw", intro: { en: "<p>Commander</p>" }, updated_at: "2026-10-23T10:00:00Z" };

  it("uses the checklist's password and keeps only this plan's shown items and lines in order", () => {
    const items = [
      { id: "i2", plan_id: "p1", phase: "day", text: { en: "Second" }, sort_order: 1, updated_at: "2026-10-25T08:00:00Z" },
      { id: "i1", plan_id: "p1", phase: "someday", text: { en: "First" }, note: { en: "R4s" }, sort_order: 0 },
      { id: "ix", plan_id: "p2", text: { en: "Other plan" }, sort_order: 0 },
      { id: "ih", plan_id: "p1", text: { en: "Hidden" }, published: false, sort_order: 2 },
    ];
    const rules = [
      { id: "r2", plan_id: "p1", section: "general", kind: "dont", text: { en: "No passwords in public" }, sort_order: 1 },
      { id: "r1", plan_id: "p1", section: "odd", kind: "odd", text: { en: "One voice" }, sort_order: 0 },
    ];
    const mapped = mapKvkChecklistPlan(plan, brief, items, rules);
    expect(mapped.password).toBe("boss-pw");
    expect(mapped.planId).toBe("p1");
    expect(mapped.battleAt).toBe("2026-11-07T12:00:00.000Z");
    expect(mapped.items.map((i) => i.id)).toEqual(["i1", "i2"]);
    // Unknown phases fall back to "before"; the note is kept.
    expect(mapped.items[0]).toMatchObject({ phase: "before", note: { en: "R4s" } });
    expect(mapped.items[1].phase).toBe("day");
    expect(mapped.rules.map((r) => [r.id, r.section, r.kind])).toEqual([
      ["r1", "commander", "info"],
      ["r2", "general", "dont"],
    ]);
    expect(mapped.updatedAt).toBe("2026-10-25T08:00:00.000Z");
  });
});

describe("mapKvkLeaderPlan", () => {
  const plan = { id: "p1", slug: "oct", title: { en: "Castle Battle" }, event_type: "castle_battle", battle_at: "2026-10-25T14:00:00Z", min_skill_level: 4, password: "plan-pw" };
  const brief = { id: "b1", plan_id: "p1", password: "leader-pw", intro: { en: "<p>Leaders</p>" }, updated_at: "2026-10-23T10:00:00Z" };

  it("uses the leaders' password, never the plan's, and keeps only this plan's shown rallies in order", () => {
    const rallies = [
      { id: "r2", plan_id: "p1", target: { en: "Second" }, name: "B", sort_order: 1, infantry_pct: 50, archers_pct: 50, updated_at: "2026-10-24T09:00:00Z" },
      { id: "r1", plan_id: "p1", target: { en: "First" }, name: "A", side: "defense", team: "tmp", position: { en: "Front" }, start_at: "2026-10-25T14:05:00Z", pets_offset_minutes: 120, hero_1: "amane", hero_2: " ", sort_order: 0, infantry_pct: 100 },
      { id: "rx", plan_id: "p2", name: "Other plan", sort_order: 0 },
      { id: "rh", plan_id: "p1", name: "Hidden", published: false, sort_order: 2 },
    ];
    const mapped = mapKvkLeaderPlan(plan, brief, rallies);
    expect(mapped.password).toBe("leader-pw");
    expect(mapped.slug).toBe("oct");
    expect(mapped.eventType).toBe("castle_battle");
    expect(mapped.minSkillLevel).toBe(4);
    expect(mapped.rallies.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(mapped.rallies[0]).toMatchObject({
      side: "defense",
      team: "tmp",
      position: { en: "Front" },
      startAt: "2026-10-25T14:05:00.000Z",
      petsOffsetMinutes: 120,
      heroSlugs: ["amane", null, null],
      infantry: 100,
    });
    // Defaults: attack, [KvK], no start time, no pets.
    expect(mapped.rallies[1]).toMatchObject({ side: "attack", team: "kvk", startAt: null, petsOffsetMinutes: null });
    // "Updated" is the latest change to the brief or a rally.
    expect(mapped.updatedAt).toBe("2026-10-24T09:00:00.000Z");
  });

  it("keeps this plan's shown leader rules in order, with their audience", () => {
    const rules = [
      { id: "l2", plan_id: "p1", audience: "garrison", kind: "do", text: { en: "Hold" }, sort_order: 1 },
      { id: "l1", plan_id: "p1", audience: "bogus", text: { en: "March time" }, sort_order: 0 },
      { id: "lx", plan_id: "p2", text: { en: "Other" } },
      { id: "lh", plan_id: "p1", text: { en: "Hidden" }, published: false },
    ];
    const mapped = mapKvkLeaderPlan(plan, brief, [], rules);
    expect(mapped.rules.map((r) => [r.id, r.audience, r.kind])).toEqual([
      ["l1", "all", "info"],
      ["l2", "garrison", "do"],
    ]);
  });

  it("drops a pets offset outside 0–1440 minutes", () => {
    const mapped = mapKvkLeaderPlan(plan, brief, [{ id: "r", plan_id: "p1", pets_offset_minutes: 5000 }]);
    expect(mapped.rallies[0].petsOffsetMinutes).toBeNull();
  });

  it("tolerates a half-filled brief", () => {
    const mapped = mapKvkLeaderPlan({ id: "p1" }, {}, []);
    expect(mapped.password).toBe("");
    expect(mapped.intro).toEqual({});
    expect(mapped.rallies).toEqual([]);
    expect(mapped.battleAt).toBeNull();
  });
});
