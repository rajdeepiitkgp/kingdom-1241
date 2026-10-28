// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { expectedTexts, glossaryFindings, labelFindings, pendingFixes, reviewHash, reviewItems, styleFindings, type ReviewInput } from "@/lib/i18n/ui-review";
import type { GlossaryEntry } from "@/lib/translate/glossary";

const glossary: GlossaryEntry[] = [
  { term: "Kingdom 1241", keep: true },
  { term: "Kingdom", translations: { fr: "Royaume" } },
  { term: "Rally", translations: { fr: "ralliement", ja: "集結" } },
  { term: "Rally leader", translations: { fr: "chef de ralliement" } },
];

describe("glossary check", () => {
  it("flags a game term the translation doesn't use, plurals included", () => {
    expect(glossaryFindings("Start your rally now.", "Lance ton rassemblement.", "fr", glossary)).toEqual(['glossary: "Rally" should be "ralliement"']);
    expect(glossaryFindings("Two rallies land.", "Deux ralliements arrivent.", "fr", glossary)).toEqual([]);
    expect(glossaryFindings("Start your rally.", "集結を開始してください。", "ja", glossary)).toEqual([]);
  });

  it("checks the longer term first and not the shorter one inside it", () => {
    expect(glossaryFindings("Rally leaders of Kingdom 1241", "Les chefs de ralliement du Kingdom 1241", "fr", glossary)).toEqual([]);
    expect(glossaryFindings("Kingdom 1241", "Royaume 1241", "fr", glossary)).toEqual(['glossary: "Kingdom 1241" should be "Kingdom 1241"']);
  });

  it("reads Turkish capitals, Italian articles and plural endings as the same term", () => {
    const terms: GlossaryEntry[] = [
      { term: "Alliance", translations: { tr: "İttifak" } },
      { term: "Rally leader", translations: { it: "leader del rally" } },
      { term: "Hero", translations: { it: "eroe" } },
    ];
    expect(glossaryFindings("The alliance chat", "ittifak sohbeti", "tr", terms)).toEqual([]);
    expect(glossaryFindings("Enemy rally leaders and heroes", "Leader dei rally nemici e gli eroi", "it", terms)).toEqual([]);
  });

  it("says nothing for a language the glossary has no word for", () => {
    expect(glossaryFindings("Start your rally.", "Ralliyi başlat.", "tr", glossary)).toEqual([]);
  });
});

describe("label check", () => {
  const english = { "sync.copyChat": "Copy for game chat", "sync.gar.sendNow": "SEND NOW", "x.common": "game clock", "x.tip": "" };
  const live = { "sync.copyChat": { en: "Copy for game chat", fr: "Copier pour le chat du jeu" }, "sync.gar.sendNow": { en: "SEND NOW", fr: "ENVOYER MAINTENANT" }, "x.common": { fr: "horloge" } };

  it("flags a named button whose page label the translation doesn't use", () => {
    expect(labelFindings("tour.a", "Send when it says SEND NOW.", "Envoie quand il affiche SEND NOW.", "fr", english, live)).toEqual([
      'label: "SEND NOW" reads "ENVOYER MAINTENANT" on the page (sync.gar.sendNow)',
    ]);
    expect(labelFindings("tour.a", "Copy for game chat sends it.", "« Copier pour le chat du jeu » l'envoie.", "fr", english, live)).toEqual([]);
  });

  it("checks the longest label, whole words only, and never the guide's own texts", () => {
    const more = { ...english, "sync.row.late": "Too late", "sync.leader.tooLate": "Too late for this hit time", "kvk.role.rally_lead": "Rally lead", "tour.x.title": "Your march" };
    const page = { ...live, "sync.row.late": { fr: "Trop tard" }, "sync.leader.tooLate": { fr: "Trop tard pour cette heure" }, "kvk.role.rally_lead": { fr: "Chef" }, "tour.x.title": { fr: "Ta marche" } };
    expect(labelFindings("a", "Too late for this hit time: Rally leaders. Your march", "Trop tard pour cette heure : les chefs. Ta marche", "fr", more, page)).toEqual([]);
    expect(labelFindings("a", "Governor ID", "領主 ID", "ja", { g: "Governor ID" }, { g: { ja: "領主ID" } })).toEqual([]);
  });

  it("ignores lower-case phrases and the key itself", () => {
    expect(labelFindings("tour.a", "Watch the game clock.", "Regarde l'heure.", "fr", english, live)).toEqual([]);
    expect(labelFindings("sync.copyChat", "Copy for game chat", "Copier", "fr", english, live)).toEqual([]);
  });
});

describe("style and state", () => {
  it("flags casual Japanese endings", () => {
    expect(styleFindings("入力してね。", "ja")).toHaveLength(1);
    expect(styleFindings("参加しよう", "ja")).toHaveLength(1);
    expect(styleFindings("入力してください。", "ja")).toEqual([]);
    expect(styleFindings("Tamam, ne yapalım", "tr")).toEqual([]);
  });

  const input: ReviewInput = {
    english: { a: "Start the rally", b: "Hello {n}" },
    handWritten: { a: ["en", "de"], b: ["en", "de"] },
    live: { a: { en: "Start the rally", de: "x", fr: "Lance le rassemblement" }, b: { en: "Hello {n}", de: "y", fr: "Bonjour {n}" } },
    locales: ["fr"],
    glossary,
    reviewed: { a: { en: "Start the rally", fr: "Lance le ralliement" } },
    state: {},
  };

  it("lists new strings and flagged ones, with the reviewed fix and whether it is live", () => {
    const items = reviewItems(input);
    expect(items.map((i) => i.key)).toEqual(["a", "b"]);
    expect(items[0].texts.fr.findings).toEqual(['glossary: "Rally" should be "ralliement"', "reviewed: the fix in ui-reviewed.ts isn't live yet (run sync-ui)"]);
    expect(items[0].reviewed).toEqual({ en: "Start the rally", fr: "Lance le ralliement" });
    expect(items[1].texts.fr.findings).toEqual([]);
  });

  it("records the reviewed text as the expected state, so a string drops out once reviewed (hints only with all)", () => {
    expect(expectedTexts(input, "a")).toEqual({ fr: "Lance le ralliement" });
    const state = { a: reviewHash("Start the rally", { fr: "Lance le ralliement" }), b: reviewHash("Hello {n}", { fr: "Bonjour {n}" }) };
    expect(reviewItems({ ...input, state })).toEqual([]);
    const all = reviewItems({ ...input, state }, () => true, { all: true });
    expect(all.map((i) => [i.key, i.changed])).toEqual([["a", false]]);
    expect(pendingFixes(input)).toBe(1);
  });

  it("keeps errors on the list and skips a translation whose English is about to be replaced", () => {
    const state = { b: reviewHash("Hello {n}", { fr: "Bonjour {n}" }) };
    const broken = { ...input, state, live: { ...input.live, b: { en: "Hello {n}", fr: "Bonjour" } } };
    expect(reviewItems(broken, (k) => k === "b")[0].texts.fr.findings).toEqual(["placeholders differ from the English"]);
    const outdated = { ...input, live: { ...input.live, a: { en: "Old English", fr: "Ancien" } } };
    expect(reviewItems(outdated, (k) => k === "a")[0].texts.fr.findings).toEqual([
      "live: the site still has older English (run sync-ui)",
      "reviewed: the fix in ui-reviewed.ts isn't live yet (run sync-ui)",
    ]);
  });
});
