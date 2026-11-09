// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { numberSeparators, parseLocalizedNumber } from "@/lib/tools/number-input";

describe("number input", () => {
  it("knows each language's marks, English's for an unknown one", () => {
    expect(numberSeparators("en")).toEqual({ decimal: ".", group: "," });
    expect(numberSeparators("de")).toEqual({ decimal: ",", group: "." });
    expect(numberSeparators("fr").decimal).toBe(",");
    expect(numberSeparators("x")).toEqual({ decimal: ".", group: "," });
  });

  it("reads whole numbers whatever the grouping", () => {
    for (const locale of ["en", "de"]) {
      expect(parseLocalizedNumber("1,500,000", locale)).toBe(1_500_000);
      expect(parseLocalizedNumber("1 500 000", locale)).toBe(1_500_000);
      expect(parseLocalizedNumber("1.500.000", locale)).toBe(1_500_000);
      expect(parseLocalizedNumber("-12", locale)).toBe(-12);
    }
    expect(parseLocalizedNumber("٤٨٠٠", "ar")).toBe(4800);
  });

  it("reads decimals the English way", () => {
    expect(parseLocalizedNumber("1.5", "en", true)).toBe(1.5);
    expect(parseLocalizedNumber("1,5", "en", true)).toBe(1.5);
    expect(parseLocalizedNumber("1,25", "en", true)).toBe(1.25);
    expect(parseLocalizedNumber("1,250", "en", true)).toBe(1250);
    expect(parseLocalizedNumber("2,500.75", "en", true)).toBe(2500.75);
    expect(parseLocalizedNumber("0.125", "en", true)).toBe(0.125);
  });

  it("reads decimals the German and French way, and the Arabic marks as themselves", () => {
    expect(parseLocalizedNumber("2.500", "de", true)).toBe(2500);
    expect(parseLocalizedNumber("2,5", "de", true)).toBe(2.5);
    expect(parseLocalizedNumber("1.500,50", "de", true)).toBe(1500.5);
    expect(parseLocalizedNumber("0,125", "de", true)).toBe(0.125);
    expect(parseLocalizedNumber("1.5", "de", true)).toBe(1.5);
    expect(parseLocalizedNumber("1 500,5", "fr", true)).toBe(1500.5);
    expect(parseLocalizedNumber("٢٫٥", "ar", true)).toBe(2.5);
    expect(parseLocalizedNumber("١٬٥٠٠", "ar", true)).toBe(1500);
    expect(parseLocalizedNumber("١٬٥٠٠٫٢٥", "ar", true)).toBe(1500.25);
  });

  it("is 0 for empty or hopeless input", () => {
    expect(parseLocalizedNumber("", "en")).toBe(0);
    expect(parseLocalizedNumber("abc", "en")).toBe(0);
    expect(parseLocalizedNumber("-", "en", true)).toBe(0);
  });
});
