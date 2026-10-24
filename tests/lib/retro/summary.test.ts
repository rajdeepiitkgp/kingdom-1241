import { describe, expect, it } from "vitest";
import { averageOf, formatAverage, overallAverage, percent, summarizeByAlliance, summarizeRatings } from "@/lib/retro/summary";

const responses = [
  { allianceTag: "NAM", ratings: { overall: 5, planning: 4 } },
  { allianceTag: "NAM", ratings: { overall: 3, planning: 4, coordination: 9 } }, // 9 is out of range → ignored
  { allianceTag: null, ratings: { overall: 0 } },
];

describe("summarizeRatings", () => {
  it("averages and counts per question, with a 0…5 distribution", () => {
    const [overall, planning, coordination] = summarizeRatings(responses, ["overall", "planning", "coordination"]);
    expect(overall).toEqual({ key: "overall", count: 3, average: 8 / 3, distribution: [1, 0, 0, 1, 0, 1] });
    expect(planning.average).toBe(4);
    expect(planning.count).toBe(2);
    expect(coordination).toEqual({ key: "coordination", count: 0, average: null, distribution: [0, 0, 0, 0, 0, 0] });
    expect(overallAverage([overall, planning, coordination])).toBeCloseTo((8 / 3 + 4) / 2);
    expect(overallAverage([coordination])).toBeNull();
  });

  it("groups by alliance, biggest first, others last", () => {
    const groups = summarizeByAlliance(responses, ["overall"]);
    expect(groups.map((g) => [g.tag, g.count])).toEqual([
      ["NAM", 2],
      [null, 1],
    ]);
    expect(groups[0].averages.overall).toBe(4);
    expect(groups[1].averages.overall).toBe(0);
  });

  it("formats", () => {
    expect(averageOf([])).toBeNull();
    expect(formatAverage(null)).toBe("—");
    expect(formatAverage(3.26)).toBe("3.3");
    expect(formatAverage(4)).toBe("4.0");
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});
