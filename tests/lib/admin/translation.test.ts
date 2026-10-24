import { describe, expect, it } from "vitest";
import { isEditableTextColumn, parseEditLang, pendingColumns, translationPending, withLanguage } from "@/lib/admin/translation";
import { columnHashes, encodeColumnHashes, sourceHash } from "@/lib/translate/hash";

describe("translationPending", () => {
  it("is false when the stored hash matches the English text", () => {
    const row = { text: { en: "No buffs", de: "Keine Buffs" }, source_hash: sourceHash({ text: "No buffs" }) };
    expect(translationPending("kvk_rules", row)).toBe(false);
  });
  it("is true after the English text changed", () => {
    const row = { text: { en: "No buffs at all" }, source_hash: sourceHash({ text: "No buffs" }) };
    expect(translationPending("kvk_rules", row)).toBe(true);
  });
  it("hashes every translatable column of the table, like the pipeline", () => {
    const row = { title: { en: "T" }, intro: { en: "<p>I</p>" }, source_hash: sourceHash({ title: "T", intro: "<p>I</p>" }) };
    expect(translationPending("kvk_plans", row)).toBe(false);
  });
  it("names only the changed column with per-column hashes", () => {
    const stored = encodeColumnHashes(columnHashes({ title: "T", intro: "<p>I</p>" }));
    expect(pendingColumns("kvk_plans", { title: { en: "T2" }, intro: { en: "<p>I</p>" }, source_hash: stored })).toEqual(["title"]);
    expect(pendingColumns("kvk_plans", { title: { en: "T" }, intro: { en: "<p>I</p>" }, source_hash: stored })).toEqual([]);
  });
  it("is false for rows without English text or unknown tables", () => {
    expect(translationPending("kvk_formations", { note: {}, source_hash: null })).toBe(false);
    expect(translationPending("nope", { note: { en: "x" }, source_hash: null })).toBe(false);
  });
});

describe("editable columns and languages", () => {
  it("whitelists the text columns only", () => {
    expect(isEditableTextColumn("kvk_plans", "intro")).toBe(true);
    expect(isEditableTextColumn("kvk_plans", "password")).toBe(false);
    expect(isEditableTextColumn("profiles", "role")).toBe(false);
  });
  it("falls back to English for unknown languages", () => {
    expect(parseEditLang("de", ["en", "de"])).toBe("de");
    expect(parseEditLang("xx", ["en", "de"])).toBe("en");
    expect(parseEditLang(undefined, ["en", "de"])).toBe("en");
  });
  it("sets or removes one language without touching the others", () => {
    expect(withLanguage({ en: "Hi", de: "Hallo" }, "de", "Servus")).toEqual({ en: "Hi", de: "Servus" });
    expect(withLanguage({ en: "Hi", de: "Hallo" }, "de", "")).toEqual({ en: "Hi" });
    expect(withLanguage(null, "fr", "Salut")).toEqual({ fr: "Salut" });
  });
});
