import { describe, expect, it } from "vitest";
import { bestOffset, clockSample } from "@/lib/rally-sync/clock";

describe("rally sync clock correction", () => {
  it("estimates the offset from the midpoint of the round trip", () => {
    // Device sent at 1000, got the answer at 1200; the server said 1600 → the device is 500 ms slow.
    expect(clockSample(1000, 1200, 1600)).toEqual({ offset: 500, rtt: 200 });
  });

  it("trusts the sample with the shortest round trip", () => {
    const samples = [clockSample(0, 900, 2000), clockSample(5000, 5080, 5540), clockSample(9000, 9400, 9900)];
    expect(bestOffset(samples)).toBe(500);
    expect(bestOffset([])).toBe(0);
  });
});
