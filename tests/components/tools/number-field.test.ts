import { describe, expect, it } from "vitest";
import { parseNumber } from "@/components/tools/NumberField";

describe("parseNumber", () => {
  it("ignores thousands separators and spaces for whole numbers", () => {
    expect(parseNumber("1,500,000")).toBe(1_500_000);
    expect(parseNumber("1 500 000")).toBe(1_500_000);
    expect(parseNumber("1.500.000")).toBe(1_500_000);
    expect(parseNumber("-12")).toBe(-12);
  });
  it("reads a decimal with a dot or a trailing comma, keeps grouping commas", () => {
    expect(parseNumber("1.5", true)).toBe(1.5);
    expect(parseNumber("1,5", true)).toBe(1.5);
    expect(parseNumber("1,25", true)).toBe(1.25);
    expect(parseNumber("1,250", true)).toBe(1250);
    expect(parseNumber("2,500.75", true)).toBe(2500.75);
  });
  it("is 0 for empty or hopeless input", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber("abc")).toBe(0);
    expect(parseNumber("-", true)).toBe(0);
  });
});
