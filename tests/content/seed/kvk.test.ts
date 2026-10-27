import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeedContent } from "@/content/seed";
import { SEED_HEROES } from "@/content/seed/heroes";
import { SEED_CHECKLIST, SEED_KVK_PLAN, SEED_LEADER_BRIEF } from "@/content/seed/kvk";
import { isValidRatio } from "@/lib/kvk/formations";

/** The seed must be something the site can show on first deploy without surprises. */

describe("seed heroes", () => {
  it("have unique slugs and a bundled portrait each", () => {
    const slugs = SEED_HEROES.map((h) => h.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const hero of SEED_HEROES) {
      expect(existsSync(resolve(process.cwd(), "public/heroes", `${hero.slug}.png`)), `missing icon for ${hero.slug}`).toBe(true);
    }
  });

  it("includes the heroes named in the placeholder battle plan", () => {
    const slugs = new Set(SEED_HEROES.map((h) => h.slug));
    for (const formation of SEED_KVK_PLAN.formations) {
      for (const slug of formation.heroes) if (slug) expect(slugs.has(slug), `unknown hero ${slug}`).toBe(true);
    }
  });
});

describe("seed battle plan", () => {
  it("fits the game's 12 preset slots with unique labels and valid ratios", () => {
    const labels = SEED_KVK_PLAN.formations.map((f) => f.label);
    expect(labels.length).toBeLessThanOrEqual(12);
    expect(new Set(labels).size).toBe(labels.length);
    for (const f of SEED_KVK_PLAN.formations) expect(isValidRatio(f), `ratio of ${f.label}`).toBe(true);
  });

  it("builds into the same shape the pages consume, with the password kept server-side", () => {
    const { kvkPlan, heroes } = buildSeedContent();
    expect(kvkPlan.active).toBe(true);
    expect(kvkPlan.password).not.toBe("");
    expect(kvkPlan.formations).toHaveLength(SEED_KVK_PLAN.formations.length);
    expect(kvkPlan.intro.en).toContain("<p>");
    expect(heroes.every((h) => h.iconUrl?.startsWith("/heroes/"))).toBe(true);
  });
});

describe("seed rally-leader page", () => {
  it("names known heroes, uses valid ratios and has its own password", () => {
    const slugs = new Set(SEED_HEROES.map((h) => h.slug));
    for (const rally of SEED_LEADER_BRIEF.rallies) {
      expect(isValidRatio(rally), `ratio of ${rally.target}`).toBe(true);
      for (const slug of rally.heroes) if (slug) expect(slugs.has(slug), `unknown hero ${slug}`).toBe(true);
    }
    const { kvkPlan, kvkLeaderPlan } = buildSeedContent();
    expect(kvkLeaderPlan.planId).toBe(kvkPlan.id);
    expect(kvkLeaderPlan.password).not.toBe("");
    expect(kvkLeaderPlan.password).not.toBe(kvkPlan.password);
    expect(kvkLeaderPlan.rallies).toHaveLength(SEED_LEADER_BRIEF.rallies.length);
    expect(kvkLeaderPlan.rules).toHaveLength(SEED_LEADER_BRIEF.rules.length);
    // Placeholders stay recognisable as placeholders.
    for (const r of SEED_LEADER_BRIEF.rules) expect(r.text).toMatch(/placeholder/i);
  });
});

describe("seed commander checklist", () => {
  it("belongs to the placeholder plan, has its own password and stays recognisable as a placeholder", () => {
    const { kvkPlan, kvkLeaderPlan, kvkChecklistPlan } = buildSeedContent();
    expect(kvkChecklistPlan.planId).toBe(kvkPlan.id);
    expect(kvkChecklistPlan.password).not.toBe("");
    expect(new Set([kvkPlan.password, kvkLeaderPlan.password, kvkChecklistPlan.password]).size).toBe(3);
    expect(kvkChecklistPlan.items).toHaveLength(SEED_CHECKLIST.items.length);
    expect(kvkChecklistPlan.rules).toHaveLength(SEED_CHECKLIST.rules.length);
    expect(new Set(kvkChecklistPlan.items.map((i) => i.id)).size).toBe(kvkChecklistPlan.items.length);
    for (const line of [...SEED_CHECKLIST.items, ...SEED_CHECKLIST.rules]) expect(line.text).toMatch(/placeholder/i);
    expect(SEED_CHECKLIST.introMarkdown).toMatch(/placeholder/i);
  });
});
