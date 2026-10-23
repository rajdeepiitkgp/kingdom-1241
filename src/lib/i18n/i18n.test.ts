import { describe, expect, it } from "vitest";
import { format } from "./dictionary";
import { pick } from "./localized";
import { negotiateLocale, parseAcceptLanguage } from "./negotiate";
import { localePath, stripLocale, switchLocaleInPath } from "./paths";

describe("pick", () => {
  it("prefers the locale, then English, then anything", () => {
    expect(pick({ en: "Hello", de: "Hallo" }, "de")).toBe("Hallo");
    expect(pick({ en: "Hello", de: "" }, "de")).toBe("Hello");
    expect(pick({ en: "Hello" }, "ar")).toBe("Hello");
    expect(pick({ pl: "Cześć" }, "ar")).toBe("Cześć");
    expect(pick(undefined, "en")).toBe("");
  });
});

describe("negotiateLocale", () => {
  const enabled = ["en", "de", "ko", "pl", "ar"];

  it("uses the cookie when it is an enabled locale", () => {
    expect(negotiateLocale(enabled, "pl", "de-DE")).toBe("pl");
    expect(negotiateLocale(enabled, "fr", "de-DE")).toBe("de");
  });

  it("matches Accept-Language by quality and base language", () => {
    expect(negotiateLocale(enabled, null, "fr-FR,fr;q=0.9,ar;q=0.8")).toBe("ar");
    expect(negotiateLocale(enabled, null, "de-AT,en;q=0.5")).toBe("de");
    expect(negotiateLocale(enabled, null, "ko-KR")).toBe("ko");
  });

  it("falls back to English, or the first enabled locale", () => {
    expect(negotiateLocale(enabled, null, "ja")).toBe("en");
    expect(negotiateLocale(["de", "pl"], null, "ja")).toBe("de");
    expect(negotiateLocale([], null, null)).toBe("en");
  });

  it("parses Accept-Language headers", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9,pl;q=0.8,*;q=0.1")).toEqual(["en-US", "en", "pl"]);
    expect(parseAcceptLanguage("de;q=0, pl")).toEqual(["pl"]);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe("paths", () => {
  it("builds and rewrites locale-prefixed paths", () => {
    expect(localePath("de")).toBe("/de");
    expect(localePath("de", "/guides/kvk")).toBe("/de/guides/kvk");
    expect(switchLocaleInPath("/en/guides/kvk", "ar")).toBe("/ar/guides/kvk");
    expect(switchLocaleInPath("/", "ar")).toBe("/ar");
    expect(stripLocale("/en/guides/kvk")).toBe("/guides/kvk");
    expect(stripLocale("/en")).toBe("/");
  });
});

describe("format", () => {
  it("replaces placeholders and leaves unknown ones alone", () => {
    expect(format("Every {n} days", { n: 3 })).toBe("Every 3 days");
    expect(format("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});
