import { describe, expect, it } from "vitest";
import { REVIEWED_UI, withReviewed } from "@/content/seed/ui-reviewed";
import { UI_STRINGS } from "@/content/seed/ui-strings";
import { LANGUAGE_REGISTRY } from "@/lib/i18n/languages";
import { uiLabelKeys } from "@/lib/tour/tour";

const entries = Object.entries(REVIEWED_UI) as [keyof typeof UI_STRINGS, Record<string, string>][];
const placeholders = (s: string) => [...[...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]), ...[...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => `{${m[1]}}`), ...uiLabelKeys(s)].sort();

describe("reviewed translations", () => {
  it("belong to existing strings and were reviewed against today's English (else review again or delete the entry)", () => {
    for (const [key, reviewed] of entries) {
      expect(key in UI_STRINGS, `${key} is not a UI string any more`).toBe(true);
      expect(reviewed.en, `${key}: the English changed since the review`).toBe(UI_STRINGS[key].en);
    }
  });

  it("only cover machine-translated languages, never English or the hand-written ones", () => {
    for (const [key, reviewed] of entries) {
      for (const lang of Object.keys(reviewed).filter((l) => l !== "en")) {
        expect(lang in UI_STRINGS[key], `${key}.${lang} is hand-written in ui-strings.ts: fix it there`).toBe(false);
        expect(lang in LANGUAGE_REGISTRY, `${key}.${lang} is not a known language`).toBe(true);
      }
    }
  });

  it("keep every placeholder of the English and leave no language empty", () => {
    for (const [key, reviewed] of entries) {
      for (const [lang, text] of Object.entries(reviewed)) {
        expect(text.trim(), `${key}.${lang}`).toBeTruthy();
        expect(placeholders(text), `${key}.${lang}`).toEqual(placeholders(reviewed.en));
      }
    }
  });

  it("lay over the text while the English matches and step aside once it changes", () => {
    const [key, reviewed] = entries[0];
    const { en, ...languages } = reviewed;
    expect(withReviewed(key, { ...UI_STRINGS[key] })).toEqual({ ...UI_STRINGS[key], ...languages });
    expect(withReviewed(key, { en: `${en} (changed)`, de: "x" })).toEqual({ en: `${en} (changed)`, de: "x" });
    expect(withReviewed("no.such.key", { en: "a" })).toEqual({ en: "a" });
  });
});
