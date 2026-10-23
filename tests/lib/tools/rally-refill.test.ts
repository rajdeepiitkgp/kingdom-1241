import { describe, expect, it } from "vitest";
import { calculateRefill, largestRemainderRound } from "@/lib/tools/rally-refill";

describe("calculateRefill", () => {
  it("fills an empty rally exactly to the target ratio", () => {
    const r = calculateRefill({
      capacity: 1_000_000,
      current: { infantry: 0, cavalry: 0, archers: 0 },
      target: { infantry: 1, cavalry: 10, archers: 89 },
    });
    expect(r.invalidRatio).toBe(false);
    expect(r.remaining).toBe(1_000_000);
    expect(r.rows.map((x) => x.toSend)).toEqual([10_000, 100_000, 890_000]);
    expect(r.totalToSend).toBe(1_000_000);
    expect(r.overTarget).toBe(false);
  });

  it("tops up only the missing troops when nothing is over target", () => {
    const r = calculateRefill({
      capacity: 100_000,
      current: { infantry: 20_000, cavalry: 10_000, archers: 10_000 },
      target: { infantry: 50, cavalry: 25, archers: 25 },
    });
    expect(r.rows.map((x) => x.toSend)).toEqual([30_000, 15_000, 15_000]);
    expect(r.rows.map((x) => x.after)).toEqual([50_000, 25_000, 25_000]);
  });

  it("splits the free capacity proportionally when a type is over target", () => {
    const r = calculateRefill({
      capacity: 100_000,
      current: { infantry: 40_000, cavalry: 0, archers: 0 }, // infantry already 40%, target 10%
      target: { infantry: 10, cavalry: 45, archers: 45 },
    });
    expect(r.overTarget).toBe(true);
    expect(r.remaining).toBe(60_000);
    expect(r.rows[0].toSend).toBe(0);
    expect(r.rows[1].toSend + r.rows[2].toSend).toBe(60_000);
    expect(r.rows[1].toSend).toBe(30_000);
    expect(r.rows[2].toSend).toBe(30_000);
  });

  it("flags a full rally and an invalid ratio", () => {
    const full = calculateRefill({
      capacity: 10,
      current: { infantry: 5, cavalry: 5, archers: 0 },
      target: { infantry: 50, cavalry: 50, archers: 0 },
    });
    expect(full.full).toBe(true);
    expect(full.totalToSend).toBe(0);

    const bad = calculateRefill({
      capacity: 10,
      current: { infantry: 0, cavalry: 0, archers: 0 },
      target: { infantry: 50, cavalry: 50, archers: 50 },
    });
    expect(bad.invalidRatio).toBe(true);
  });

  it("ignores garbage input", () => {
    const r = calculateRefill({
      capacity: Number.NaN,
      current: { infantry: -5, cavalry: Number.POSITIVE_INFINITY, archers: 0 },
      target: { infantry: 50, cavalry: 25, archers: 25 },
    });
    expect(r.totalToSend).toBe(0);
    expect(r.deployed).toBe(0);
  });
});

describe("largestRemainderRound", () => {
  it("rounds to integers that add up to the total", () => {
    expect(largestRemainderRound([33.3, 33.3, 33.4], 100)).toEqual([33, 33, 34]);
    expect(largestRemainderRound([0.5, 0.5, 0.5, 0.5], 2)).toEqual([1, 1, 0, 0]);
    expect(largestRemainderRound([0, 0, 0], 0)).toEqual([0, 0, 0]);
  });
});
