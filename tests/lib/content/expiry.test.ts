import { describe, expect, it } from "vitest";
import { EXPIRY_LOOKBACK_MS, expiryWindow } from "@/lib/content/expiry";

describe("expiryWindow", () => {
  it("looks back two hours from now, so a late hourly run still catches an expiry", () => {
    expect(EXPIRY_LOOKBACK_MS).toBe(2 * 60 * 60 * 1000);
    expect(expiryWindow(new Date("2026-10-29T14:23:00Z"))).toEqual({ from: "2026-10-29T12:23:00.000Z", to: "2026-10-29T14:23:00.000Z" });
  });
});
