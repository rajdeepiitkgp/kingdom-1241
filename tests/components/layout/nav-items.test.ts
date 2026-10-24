import { describe, expect, it } from "vitest";
import { isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";

describe("isActivePath", () => {
  it("matches home only exactly", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("", "/")).toBe(true);
    expect(isActivePath("/events", "/")).toBe(false);
  });
  it("matches a section and its sub-pages, not a sibling with the same prefix", () => {
    expect(isActivePath("/guides", "/guides")).toBe(true);
    expect(isActivePath("/guides/kvk", "/guides")).toBe(true);
    expect(isActivePath("/guidesbook", "/guides")).toBe(false);
    expect(isActivePath("/events", "/guides")).toBe(false);
  });
  it("has unique hrefs and icons in the navigation", () => {
    expect(new Set(NAV_ITEMS.map((i) => i.href)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.labelKey)).size).toBe(NAV_ITEMS.length);
  });
});
