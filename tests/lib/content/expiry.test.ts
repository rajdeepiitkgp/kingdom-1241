import { describe, expect, it } from "vitest";
import { EXPIRY_MAX_LOOKBACK_MS, expiryWindow } from "@/lib/content/expiry";

const now = new Date("2026-10-29T14:23:00Z");

describe("expiryWindow", () => {
  it("starts at the last check, however many hours GitHub let pass", () => {
    expect(expiryWindow(now, { at: "2026-10-29T08:01:00.000Z" })).toEqual({ from: "2026-10-29T08:01:00.000Z", to: "2026-10-29T14:23:00.000Z" });
  });

  it("looks back one day at most, and one day without a usable note", () => {
    expect(EXPIRY_MAX_LOOKBACK_MS).toBe(24 * 60 * 60 * 1000);
    const dayBack = { from: "2026-10-28T14:23:00.000Z", to: "2026-10-29T14:23:00.000Z" };
    expect(expiryWindow(now, { at: "2026-10-20T00:00:00.000Z" })).toEqual(dayBack);
    for (const note of [null, undefined, "x", { at: "soon" }, { at: "2026-10-30T00:00:00.000Z" }]) expect(expiryWindow(now, note)).toEqual(dayBack);
  });
});
