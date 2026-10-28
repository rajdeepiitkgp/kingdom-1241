import { describe, expect, it } from "vitest";
import { getLanguageInfo, isKnownLanguage, isLocaleCode, LANGUAGE_REGISTRY } from "@/lib/i18n/languages";

describe("getLanguageInfo", () => {
  it("returns the registry entry", () => {
    expect(getLanguageInfo("ar")).toMatchObject({ code: "ar", direction: "rtl", font: "arabic" });
    expect(getLanguageInfo("zh-TW").font).toBe("chinese");
  });
  it("makes a neutral left-to-right entry for an unknown code, so a new database row can't break the layout", () => {
    expect(getLanguageInfo("xx")).toEqual({ code: "xx", name: "xx", nativeName: "xx", direction: "ltr", font: "latin", flag: "🌐" });
  });
  it("keeps the registry consistent (code key matches the entry)", () => {
    for (const [code, info] of Object.entries(LANGUAGE_REGISTRY)) expect(info.code).toBe(code);
  });
});

describe("isLocaleCode", () => {
  it("accepts BCP-47 shaped codes", () => {
    for (const code of ["en", "de", "pt-BR", "zh-TW", "zh-Hant", "fil"]) expect(isLocaleCode(code), code).toBe(true);
  });
  it("rejects paths, upper-case primaries, empty values and non-strings", () => {
    for (const value of ["", "EN", "e", "english", "en/admin", "en-", "../en", null, undefined, 42]) expect(isLocaleCode(value), String(value)).toBe(false);
  });
});

describe("isKnownLanguage", () => {
  it("knows the registry's codes only, not inherited object keys", () => {
    expect(isKnownLanguage("fr")).toBe(true);
    expect(isKnownLanguage("zh-TW")).toBe(true);
    for (const code of ["xx", "FR", "constructor", "toString", ""]) expect(isKnownLanguage(code), code).toBe(false);
  });
});
