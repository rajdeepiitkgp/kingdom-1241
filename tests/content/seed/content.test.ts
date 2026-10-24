import { describe, expect, it } from "vitest";
import { buildSeedContent } from "@/content/seed";
import { UI_STRINGS } from "@/content/seed/ui-strings";

/** Cross-checks between the seed files: what one file refers to must exist in another. */

const seed = buildSeedContent();

function unique(label: string, values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    expect(seen.has(value), `${label}: duplicate "${value}"`).toBe(false);
    seen.add(value);
  }
}

describe("seed content", () => {
  it("links events only to guides that exist", () => {
    const guides = new Set(seed.guides.map((g) => g.slug));
    for (const event of seed.events) {
      if (event.guideSlug) expect(guides.has(event.guideSlug), `event ${event.slug} → guide ${event.guideSlug}`).toBe(true);
    }
  });

  it("uses unique ids and slugs within each collection", () => {
    unique("announcement ids", seed.announcements.map((a) => a.id));
    unique("event ids", seed.events.map((e) => e.id));
    unique("event slugs", seed.events.map((e) => e.slug));
    unique("guide ids", seed.guides.map((g) => g.id));
    unique("guide slugs", seed.guides.map((g) => g.slug));
    unique("rule topic ids", seed.ruleTopics.map((t) => t.id));
    unique("rule topic slugs", seed.ruleTopics.map((t) => t.slug));
    unique("rule ids", seed.ruleTopics.flatMap((t) => t.rules.map((r) => r.id)));
    unique("alliance ids", seed.alliances.map((a) => a.id));
    unique("alliance tags", seed.alliances.map((a) => a.tag));
    unique("gift code ids", seed.giftCodes.map((c) => c.id));
    unique("gift codes", seed.giftCodes.map((c) => c.code));
  });

  it("renders every rich-text body to HTML paragraphs", () => {
    for (const a of seed.announcements) expect(a.body.en, a.id).toMatch(/<(p|ul|h2)/);
    for (const g of seed.guides) expect(g.body.en, g.slug).toMatch(/<(p|ul|h2)/);
    for (const r of seed.ruleTopics.flatMap((t) => t.rules)) expect(r.body.en, r.id).toMatch(/<(p|ul)/);
  });
});

describe("interface strings", () => {
  const LANGUAGES = ["en", "de", "ko", "pl", "ar"] as const;

  it("exist in all five hand-written languages", () => {
    for (const [key, text] of Object.entries(UI_STRINGS)) {
      for (const lang of LANGUAGES) expect(text[lang]?.trim(), `${key}.${lang}`).toBeTruthy();
    }
  });

  it("keep the same {placeholders} in every language", () => {
    const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, text] of Object.entries(UI_STRINGS)) {
      const expected = placeholders(text.en);
      for (const lang of LANGUAGES) expect(placeholders(text[lang]), `${key}.${lang}`).toEqual(expected);
    }
  });
});
