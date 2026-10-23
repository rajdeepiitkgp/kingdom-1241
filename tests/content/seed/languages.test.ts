import { describe, expect, it } from "vitest";
import { SEED_LANGUAGES } from "@/content/seed/languages";
import { LANGUAGE_REGISTRY, type FontStack } from "@/lib/i18n/languages";
import { negotiateLocale } from "@/lib/i18n/negotiate";

const FONTS: FontStack[] = ["latin", "korean", "arabic", "japanese", "chinese"];

describe("seed languages", () => {
  it("are all known to the registry, with a font stack the layout can apply", () => {
    for (const lang of SEED_LANGUAGES) {
      const info = LANGUAGE_REGISTRY[lang.code];
      expect(info, `registry entry for ${lang.code}`).toBeDefined();
      expect(FONTS).toContain(info.font);
      expect(["ltr", "rtl"]).toContain(info.direction);
    }
  });

  it("have unique codes and sort orders, English first", () => {
    expect(new Set(SEED_LANGUAGES.map((l) => l.code)).size).toBe(SEED_LANGUAGES.length);
    expect(new Set(SEED_LANGUAGES.map((l) => l.sortOrder)).size).toBe(SEED_LANGUAGES.length);
    expect([...SEED_LANGUAGES].sort((a, b) => a.sortOrder - b.sortOrder)[0].code).toBe("en");
  });

  it("negotiates regional and script variants onto the enabled codes", () => {
    const enabled = SEED_LANGUAGES.map((l) => l.code);
    expect(negotiateLocale(enabled, null, "zh-Hant-TW,zh;q=0.9")).toBe("zh-TW");
    expect(negotiateLocale(enabled, null, "zh-TW")).toBe("zh-TW");
    expect(negotiateLocale(enabled, null, "ja-JP")).toBe("ja");
    expect(negotiateLocale(enabled, null, "fr-CA,en;q=0.5")).toBe("fr");
    expect(negotiateLocale(enabled, null, "tr-TR")).toBe("tr");
    expect(negotiateLocale(enabled, null, "it-CH")).toBe("it");
  });
});
