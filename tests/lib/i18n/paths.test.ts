import { describe, expect, it } from "vitest";
import { localePath, stripLocale, switchLocaleInPath } from "@/lib/i18n/paths";

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
