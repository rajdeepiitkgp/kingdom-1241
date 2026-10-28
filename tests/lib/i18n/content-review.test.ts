// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { cellHash, cellKey, contentFindings, type ContentCell, fixDecision, fixProblems, reviewContent, tagSignature } from "@/lib/i18n/content-review";
import type { GlossaryEntry } from "@/lib/translate/glossary";

const glossary: GlossaryEntry[] = [{ term: "Rally", translations: { fr: "ralliement" } }];
const cell = (value: Record<string, string>, extra: Partial<ContentCell> = {}): ContentCell => ({ table: "kvk_rules", id: "r1", column: "text", html: false, value, manual: {}, ...extra });

describe("content findings", () => {
  it("checks placeholders, the HTML structure, glossary terms and Japanese politeness", () => {
    expect(contentFindings(cell({ en: "Join the rally {{when}}", fr: "Rejoins le rassemblement" }), "fr", glossary)).toEqual([
      "placeholders differ from the English",
      'glossary: "Rally" should be "ralliement"',
    ]);
    const intro = cell({ en: "<p>Hold <strong>the line</strong></p>", fr: "<p>Tenez la ligne</p>" }, { column: "intro", html: true });
    expect(contentFindings(intro, "fr", glossary)).toEqual(["html: the tags differ from the English"]);
    expect(contentFindings(cell({ en: "Go", ja: "行こうね。" }), "ja", glossary)).toHaveLength(1);
    expect(contentFindings(cell({ en: "Go" }), "fr", glossary)).toEqual(["missing: no translation yet"]);
    expect(tagSignature('<p>a <a href="x">b</a></p>')).toBe("<p,<a,</a,</p");
  });
});

describe("what to look at", () => {
  const rule = cell({ en: "Start the rally", fr: "Lance le rassemblement", it: "Avvia il rally" });

  it("lists new texts, then only errors; hints on a reviewed text come back with all", () => {
    expect(reviewContent([rule], ["fr", "it"], glossary, {})).toHaveLength(1);
    const state = { [cellKey(rule)]: cellHash(rule, ["fr", "it"]) };
    expect(reviewContent([rule], ["fr", "it"], glossary, state)).toEqual([]);
    expect(reviewContent([rule], ["fr", "it"], glossary, state, { all: true })[0].changed).toBe(false);
    const broken = cell({ en: "Start {{when}}", fr: "Lance", it: "Avvia {{when}}" });
    expect(reviewContent([broken], ["fr", "it"], glossary, { [cellKey(broken)]: cellHash(broken, ["fr", "it"]) })).toHaveLength(1);
  });

  it("marks a language corrected by hand and doesn't count its findings", () => {
    const fixed = cell({ en: "Start {{when}}", fr: "Lance" }, { manual: { fr: { at: "2026-10-28T10:00:00Z", by: "[KvK] Rudy" } } });
    expect(reviewContent([fixed], ["fr"], glossary, { [cellKey(fixed)]: cellHash(fixed, ["fr"]) })).toEqual([]);
    expect(reviewContent([fixed], ["fr"], glossary, {})[0].texts.fr.manual).toEqual({ at: "2026-10-28T10:00:00Z", by: "[KvK] Rudy" });
  });
});

describe("fixes", () => {
  const fix = { table: "kvk_rules", id: "r1", column: "text", lang: "fr", en: "Start the rally {{when}}", from: "Lance le rassemblement {{when}}", to: "Lance le ralliement {{when}}" };

  it("refuses a fix that loses a placeholder, changes the HTML or targets English", () => {
    expect(fixProblems(fix, { html: false })).toEqual([]);
    expect(fixProblems({ ...fix, to: "Lance le ralliement" }, { html: false })).toEqual(["to loses or adds a placeholder"]);
    expect(fixProblems({ ...fix, en: "<p>a</p>", from: "", to: "<p>b</p><p>c</p>" }, { html: true })).toEqual(["to has other HTML tags than the English"]);
    expect(fixProblems({ ...fix, lang: "en" }, { html: false })).toEqual(["lang must be a language other than English"]);
    expect(fixProblems(fix, null)).toEqual(["not a translatable column"]);
  });

  it("writes only while the English and the translation are the reviewed ones", () => {
    expect(fixDecision({ en: fix.en, fr: fix.from }, fix)).toBe("apply");
    expect(fixDecision({ en: fix.en, fr: fix.to }, fix)).toBe("already");
    expect(fixDecision({ en: "Start now", fr: fix.from }, fix)).toBe("english-changed");
    expect(fixDecision({ en: fix.en, fr: "Corrigé à la main {{when}}" }, fix)).toBe("text-changed");
    expect(fixDecision({ en: fix.en }, { ...fix, from: "" })).toBe("apply");
  });
});
