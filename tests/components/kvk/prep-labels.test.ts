// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CALENDAR_IMAGE, DAY_IMAGES, ITEM_IMAGES, KVK_EVENT_IMAGE, MASTER_PAN_IMAGE, pointsText, SAVE_IMAGES, TIP_IMAGES } from "@/components/kvk/prep-labels";
import { UI_STRINGS } from "@/content/seed/ui-strings";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { PREP_ITEMS, PREP_POINTS, SAVE_FOR_KVK } from "@/lib/kvk/prep";

describe("prep item pictures", () => {
  const all = [
    ...Object.values(ITEM_IMAGES),
    ...Object.values(SAVE_IMAGES),
    ...Object.values(TIP_IMAGES),
    ...Object.values(DAY_IMAGES),
    MASTER_PAN_IMAGE,
    KVK_EVENT_IMAGE,
    CALENDAR_IMAGE,
  ];

  it("point at files in public/items", () => {
    for (const src of all) {
      expect(src, String(src)).toMatch(/^\/items\/[a-z-]+\.webp$/);
      expect(existsSync(join(process.cwd(), "public", src ?? "")), String(src)).toBe(true);
    }
  });

  it("only name items that exist", () => {
    const items = new Set<string>(PREP_ITEMS.map((i) => i.id));
    const saves = new Set<string>(SAVE_FOR_KVK.map((i) => i.id));
    for (const id of Object.keys(ITEM_IMAGES)) expect(items.has(id), id).toBe(true);
    for (const id of Object.keys(SAVE_IMAGES)) expect(saves.has(id), id).toBe(true);
  });
});

describe("pointsText", () => {
  const dictFor = (lang: "en" | "de" | "ar") => Object.fromEntries(Object.entries(UI_STRINGS).map(([key, text]) => [key, text[lang]])) as Dictionary;

  it("spells out per-minute speedups with the hour total", () => {
    expect(pointsText({ kind: "perMinute", n: 30 }, dictFor("en"), "en")).toBe("30 pts per minute of speedup (1 h = 1,800 pts)");
    expect(pointsText({ kind: "perMinute", n: 30 }, dictFor("de"), "de")).toBe("30 Pkt. pro Minute Beschleunigung (1 Std. = 1.800 Pkt.)");
  });

  it("groups thousands the visitor's way, always in Latin digits", () => {
    expect(pointsText({ kind: "each", n: 40000 }, dictFor("en"), "en")).toBe("40,000 pts each");
    expect(pointsText({ kind: "each", n: 40000 }, dictFor("ar"), "ar")).toMatch(/^40.000 /);
    expect(pointsText({ kind: "perTroop", min: 3, max: 75 }, dictFor("en"), "en")).toBe("3–75 pts per troop trained, by tier");
  });

  it("has a points line for every item on the council's sheet", () => {
    for (const id of Object.keys(PREP_POINTS)) expect(PREP_ITEMS.some((i) => i.id === id), id).toBe(true);
    expect(Object.keys(PREP_POINTS)).toHaveLength(19);
  });

  it("explains gathering in resource amounts", () => {
    expect(pointsText({ kind: "gathering", n: 2, bread: 1000, stone: 200, iron: 50 }, dictFor("en"), "en")).toBe(
      "2 pts per 1,000 bread or wood, 200 stone or 50 iron gathered",
    );
  });
});
