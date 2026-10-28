import { describe, expect, it } from "vitest";
import {
  addCoverage,
  describeLanguageChanges,
  hasLanguageChanges,
  hideProblem,
  languageChanges,
  languageFormValues,
  parseLanguageForm,
  savedLanguagesMessage,
} from "@/lib/admin/languages";

describe("the owner's languages list", () => {
  it("counts English texts and, per language, those without a translation", () => {
    const rows = [
      { title: { en: "Rules", de: "Regeln", fr: "" }, body: { en: "Be nice", de: "Sei nett" } },
      { title: { en: "  " }, body: null },
      { title: "not localized", body: { de: "only German" } },
    ];
    const first = addCoverage({ total: 0, missing: {} }, rows, ["title", "body"], ["de", "fr"]);
    expect(first).toEqual({ total: 2, missing: { de: 0, fr: 2 } });
    // Tables add up.
    expect(addCoverage(first, [{ text: { en: "Hello", fr: "Bonjour" } }], ["text"], ["de", "fr"])).toEqual({ total: 3, missing: { de: 1, fr: 2 } });
  });

  it("never hides English", () => {
    expect(hideProblem("en")).toContain("English");
    expect(hideProblem("de")).toBeNull();
  });
});

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
const STORED = ["en", "de", "fr", "es"];

describe("saving the languages list", () => {
  const before = [
    { code: "en", shown: true },
    { code: "de", shown: true },
    { code: "fr", shown: true },
    { code: "es", shown: false },
  ];

  it("sends every code in order and the hidden ones, and reads them back", () => {
    const after = [before[0], before[2], { code: "de", shown: false }, { code: "es", shown: true }];
    const values = languageFormValues(after);
    expect(values).toEqual({ order: "en,fr,de,es", hidden: "de" });
    expect(parseLanguageForm(form(values), STORED)).toEqual({ ok: true, value: after });
  });

  it("refuses a list that isn't the stored one: a language added, dropped or twice", () => {
    for (const order of ["en,de,fr", "en,de,fr,es,it", "en,de,de,es", ""]) {
      const parsed = parseLanguageForm(form({ order, hidden: "" }), STORED);
      expect(parsed.ok, order).toBe(false);
      if (!parsed.ok) expect(parsed.message).toContain("Reload");
    }
  });

  it("never hides English, and only hides languages on the list", () => {
    expect(parseLanguageForm(form({ order: "en,de,fr,es", hidden: "en" }), STORED)).toEqual({ ok: false, message: "English is the source language and always shown." });
    expect(parseLanguageForm(form({ order: "en,de,fr,es", hidden: "it" }), STORED).ok).toBe(false);
  });

  it("names what changed, for the unsaved line and the saved message", () => {
    const after = [before[0], before[2], { code: "de", shown: false }, { code: "es", shown: true }];
    const changes = languageChanges(before, after);
    expect(changes).toEqual({ shown: ["es"], hidden: ["de"], moved: true });
    expect(describeLanguageChanges(changes)).toBe("German hidden · Spanish shown · new order");
    expect(savedLanguagesMessage(changes)).toMatch(/^Saved: German hidden · Spanish shown · new order\. Texts edited .+ open in the player's other language/);
    expect(hasLanguageChanges(languageChanges(before, before))).toBe(false);
    expect(savedLanguagesMessage(languageChanges(before, [before[1], before[0], before[2], before[3]]))).toBe("Saved: new order.");
  });
});
