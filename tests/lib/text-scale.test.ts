import { describe, expect, it } from "vitest";
import {
  canChangeTextScale,
  DEFAULT_TEXT_SCALE,
  nextTextScale,
  parseTextScale,
  TEXT_SCALE_INIT_SCRIPT,
  TEXT_SCALE_PERCENT,
  TEXT_SCALES,
} from "@/lib/text-scale";

describe("text scale", () => {
  it("steps within the range and stops at the ends", () => {
    expect(nextTextScale("m", 1)).toBe("l");
    expect(nextTextScale("l", 1)).toBe("xl");
    expect(nextTextScale("xl", 1)).toBe("xl");
    expect(nextTextScale("m", -1)).toBe("s");
    expect(nextTextScale("s", -1)).toBe("s");
    expect(canChangeTextScale("xl", 1)).toBe(false);
    expect(canChangeTextScale("s", -1)).toBe(false);
    expect(canChangeTextScale("m", 1)).toBe(true);
  });

  it("keeps the browser default as the middle step and a sane range", () => {
    expect(TEXT_SCALE_PERCENT[DEFAULT_TEXT_SCALE]).toBe(100);
    const values = TEXT_SCALES.map((s) => TEXT_SCALE_PERCENT[s]);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...values)).toBeLessThanOrEqual(130);
  });

  it("falls back to the default for unknown stored values", () => {
    expect(parseTextScale("xl")).toBe("xl");
    expect(parseTextScale("huge")).toBe("m");
    expect(parseTextScale(null)).toBe("m");
  });

  it("ships an init script that only applies known, non-default values", () => {
    expect(TEXT_SCALE_INIT_SCRIPT).toContain("kd1241_text_scale");
    expect(TEXT_SCALE_INIT_SCRIPT).toContain("data-text-scale");
    expect(TEXT_SCALE_INIT_SCRIPT).not.toContain("\n");
    // Must be valid JavaScript.
    expect(() => new Function(TEXT_SCALE_INIT_SCRIPT)).not.toThrow();
  });
});
