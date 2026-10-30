import { describe, expect, it } from "vitest";
import { EVENT_CATEGORIES, EVENT_COLOR_KEYS, EVENT_TIMINGS } from "@/lib/events/options";

describe("event options", () => {
  it("offer each category, timing and colour once", () => {
    for (const list of [EVENT_CATEGORIES, EVENT_TIMINGS, EVENT_COLOR_KEYS]) expect(new Set(list).size).toBe(list.length);
    expect(EVENT_TIMINGS).toEqual(["fixed", "alliance"]);
    expect(EVENT_CATEGORIES).toContain("alliance");
  });
});
