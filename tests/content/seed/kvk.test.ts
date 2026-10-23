import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeedContent } from "@/content/seed";
import { SEED_HEROES } from "@/content/seed/heroes";
import { SEED_KVK_PLAN } from "@/content/seed/kvk";
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
