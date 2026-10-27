import { describe, expect, it } from "vitest";
import { activeChildHref, isActivePath, NAV_ITEMS } from "@/components/layout/nav-items";

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

describe("activeChildHref", () => {
  const kvk = ["/kvk/prep", "/kvk", "/kvk/leaders", "/kvk/checklist"];
  it("picks the most specific page of a dropdown", () => {
    expect(activeChildHref("/kvk", kvk)).toBe("/kvk");
    expect(activeChildHref("/kvk/prep", kvk)).toBe("/kvk/prep");
    expect(activeChildHref("/kvk/leaders", kvk)).toBe("/kvk/leaders");
    expect(activeChildHref("/kvk/checklist", kvk)).toBe("/kvk/checklist");
    // The feedback form belongs to the battle plan.
    expect(activeChildHref("/kvk/feedback", kvk)).toBe("/kvk");
    expect(activeChildHref("/events", kvk)).toBeNull();
  });
  it("every dropdown page sits inside its section (or is marked as a shortcut to another), with unique hrefs", () => {
    for (const item of NAV_ITEMS) {
      if (!item.children) continue;
      expect(new Set(item.children.map((c) => c.href)).size).toBe(item.children.length);
      for (const child of item.children) expect(isActivePath(child.href, item.href), child.href).toBe(!child.shortcut);
    }
  });
});
