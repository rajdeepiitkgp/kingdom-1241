// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CACHE_TAGS, cacheTagForTable, routesForTag } from "@/lib/data/cache-tags";
import { getTranslatableTable, isHtmlField, isTranslatableRow, TRANSLATABLE_TABLES } from "@/lib/translate/tables";

/** The tables the webhook installer (supabase/webhooks.sql) attaches triggers to. */
function webhookTables(): string[] {
  const sql = readFileSync(resolve(process.cwd(), "supabase/webhooks.sql"), "utf8");
  const block = /foreach t in array array\[([\s\S]*?)\]/.exec(sql);
  if (!block) throw new Error("webhooks.sql: table list not found");
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe("translatable tables", () => {
  it("each have a cache tag, so a translation expires the right pages", () => {
    for (const { table } of TRANSLATABLE_TABLES) expect(cacheTagForTable(table), table).not.toBeNull();
  });

  it("each have a webhook trigger, so an edit reaches the pipeline", () => {
    const hooked = webhookTables();
    for (const { table } of TRANSLATABLE_TABLES) expect(hooked, table).toContain(table);
  });

  it("list unique tables with at least one column", () => {
    const names = TRANSLATABLE_TABLES.map((t) => t.table);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TRANSLATABLE_TABLES) expect(t.columns.length, t.table).toBeGreaterThan(0);
    expect(getTranslatableTable("rules")?.columns.map((c) => c.name)).toEqual(["title", "body"]);
    expect(getTranslatableTable("nope")).toBeNull();
  });

  it("only translate the site settings that hold text", () => {
    expect(isTranslatableRow("site_settings", { key: "tagline" })).toBe(true);
    expect(isTranslatableRow("site_settings", { key: "kingdom_number" })).toBe(false);
    expect(isTranslatableRow("rules", { id: "x" })).toBe(true);
  });

  it("know which settings hold rich text (one value column, so the key decides)", () => {
    const value = getTranslatableTable("site_settings")!.columns[0];
    expect(isHtmlField("site_settings", "transfer_info", value)).toBe(true);
    expect(isHtmlField("site_settings", "transfer_contact", value)).toBe(true);
    expect(isHtmlField("site_settings", "tagline", value)).toBe(false);
    expect(isHtmlField("announcements", "x", { html: true })).toBe(true);
    // Every rich-text setting is translated in the first place.
    expect(isTranslatableRow("site_settings", { key: "transfer_info" })).toBe(true);
  });
});

describe("cacheTagForTable", () => {
  it("groups the KvK and rules tables under one tag and ignores unknown tables", () => {
    expect(cacheTagForTable("kvk_formations")).toBe(CACHE_TAGS.kvk);
    expect(cacheTagForTable("rule_topics")).toBe(CACHE_TAGS.rules);
    expect(cacheTagForTable("audit_log")).toBeNull();
    expect(new Set(Object.values(CACHE_TAGS)).size).toBe(Object.keys(CACHE_TAGS).length);
  });
});

describe("routesForTag", () => {
  const guidePages = "/[locale]/guides/[slug]";
  const alliancePages = "/[locale]/alliances/[tag]";

  it("expires the guide and alliance pages by route whenever what they show changes", () => {
    expect(routesForTag(cacheTagForTable("guides")!)).toEqual([guidePages, alliancePages]);
    expect(routesForTag(cacheTagForTable("guide_sections")!)).toEqual([guidePages, alliancePages]);
    expect(routesForTag(cacheTagForTable("alliances")!)).toEqual([guidePages, alliancePages]);
    expect(routesForTag(cacheTagForTable("events")!)).toEqual([guidePages]);
    expect(routesForTag(CACHE_TAGS.all)).toEqual([guidePages, alliancePages]);
  });

  it("leaves the static pages to their tags", () => {
    expect(routesForTag(CACHE_TAGS.rules)).toEqual([]);
    expect(routesForTag(CACHE_TAGS.settings)).toEqual([]);
  });
});
