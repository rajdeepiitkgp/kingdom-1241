import { describe, expect, it } from "vitest";
import { calculatePackValue, PACK_ITEM_CATALOG, ratePack, type PackLine } from "./pack-value";

const line = (itemId: string, quantity: number, overrides: Partial<PackLine> = {}): PackLine => {
  const item = PACK_ITEM_CATALOG.find((i) => i.id === itemId)!;
  return { itemId, name: item.name, quantity, gems: item.gems, basicResource: Boolean(item.basicResource), ...overrides };
};

describe("calculatePackValue", () => {
  it("compares the gem value with the direct-purchase baseline", () => {
    const r = calculatePackValue([line("gem", 1000), line("speedup-1h", 10)], 5, 500);
    expect(r.totalGems).toBe(1000 + 8000);
    expect(r.baselineGems).toBe(2500);
    expect(r.valuePercent).toBeCloseTo(360);
    expect(r.rating).toBe("poor");
  });

  it("can ignore basic resources", () => {
    const lines = [line("gem", 100), line("bread-10k", 100)];
    const withResources = calculatePackValue(lines, 1, 500, false);
    const without = calculatePackValue(lines, 1, 500, true);
    expect(withResources.totalGems).toBe(100 + 500);
    expect(without.totalGems).toBe(100);
    expect(without.lines[1].total).toBe(0);
    expect(without.lines[0].share).toBe(100);
  });

  it("handles a zero price without dividing by zero", () => {
    const r = calculatePackValue([line("gem", 10)], 0);
    expect(r.valuePercent).toBe(0);
    expect(r.rating).toBe("poor");
  });

  it("rates packs by the community thresholds", () => {
    expect(ratePack(4000)).toBe("insane");
    expect(ratePack(3999)).toBe("great");
    expect(ratePack(2500)).toBe("good");
    expect(ratePack(1500)).toBe("average");
    expect(ratePack(999)).toBe("poor");
  });
});
