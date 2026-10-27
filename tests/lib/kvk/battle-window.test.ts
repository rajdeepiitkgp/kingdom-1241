import { describe, expect, it } from "vitest";
import { battleMinutes, STANDARD_BATTLE_MINUTES, standardWindow } from "@/lib/kvk/battle-window";

describe("standardWindow", () => {
  const now = new Date("2026-10-27T09:30:00Z");
  it("uses the day already typed into the start field", () => {
    expect(standardWindow("2026-11-08T08:15", now)).toEqual({ start: "2026-11-08T12:00", end: "2026-11-08T19:00" });
  });
  it("picks today while the window is still ahead, else tomorrow", () => {
    expect(standardWindow("", now)).toEqual({ start: "2026-10-27T12:00", end: "2026-10-27T19:00" });
    expect(standardWindow("", new Date("2026-10-27T12:00:00Z")).start).toBe("2026-10-28T12:00");
    expect(standardWindow("", new Date("2026-12-31T20:00:00Z")).start).toBe("2027-01-01T12:00");
  });
});

describe("battleMinutes", () => {
  it("measures the plan's battle, or falls back to the standard 7 hours", () => {
    expect(battleMinutes("2026-11-01T12:00:00Z", "2026-11-01T17:30:00Z")).toBe(330);
    expect(STANDARD_BATTLE_MINUTES).toBe(420);
    expect(battleMinutes("2026-11-01T12:00:00Z", null)).toBe(420);
    expect(battleMinutes(null, null)).toBe(420);
    expect(battleMinutes("2026-11-01T12:00:00Z", "2026-11-01T11:00:00Z")).toBe(420);
  });
});
