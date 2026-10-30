// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { SEED_LANGUAGES } from "@/content/seed/languages";
import { GLOSSARY, glossaryForPrompt } from "@/lib/translate/glossary";

describe("translation glossary", () => {
  const languages = SEED_LANGUAGES.map((l) => l.code).filter((code) => code !== "en");

  it("names every term once", () => {
    const terms = GLOSSARY.map((e) => e.term);
    expect(new Set(terms).size).toBe(terms.length);
  });

  it("has a word for every site language on every translated term", () => {
    const gaps = GLOSSARY.filter((e) => !e.keep).flatMap((e) => languages.filter((code) => !e.translations?.[code]).map((code) => `${e.term}: ${code}`));
    expect(gaps).toEqual([]);
  });

  it("tells the model the kept terms and the preferred words of the target language", () => {
    const prompt = glossaryForPrompt("de");
    expect(prompt).toContain("Kingshot");
    expect(prompt).toContain("Königreich");
    expect(prompt).not.toContain("Royaume");
  });
});
