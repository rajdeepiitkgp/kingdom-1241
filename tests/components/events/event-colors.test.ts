import { describe, expect, it } from "vitest";
import { EVENT_COLORS, eventColor } from "@/components/events/event-colors";
import { EVENT_COLOR_KEYS } from "@/lib/events/options";

describe("event colours", () => {
  it("has classes for every colour the editor offers", () => {
    for (const key of EVENT_COLOR_KEYS) expect(EVENT_COLORS[key].icon).toMatch(/bg-/);
    expect(Object.keys(EVENT_COLORS).sort()).toEqual([...EVENT_COLOR_KEYS].sort());
  });

  it("falls back to sky for a colour a row no longer knows", () => {
    expect(eventColor("gold")).toBe(EVENT_COLORS.gold);
    expect(eventColor("plaid")).toBe(EVENT_COLORS.sky);
    expect(eventColor("constructor")).toBe(EVENT_COLORS.sky);
  });
});
