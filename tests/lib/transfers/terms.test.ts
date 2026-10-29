import { describe, expect, it } from "vitest";
import { formatTransferWindow, hasTransferTerms, NO_TRANSFER_TERMS, parseTransferTerms } from "@/lib/transfers/terms";

describe("parseTransferTerms", () => {
  it("reads stored terms", () => {
    const terms = {
      kingdomFrom: 1201,
      kingdomTo: 1260,
      windowStart: "2026-11-15T00:00:00.000Z",
      windowEnd: "2026-11-21T23:59:00.000Z",
      powerRegular: 150_000_000,
      powerLeading: null,
    };
    expect(parseTransferTerms(terms)).toEqual(terms);
    expect(hasTransferTerms(terms)).toBe(true);
  });

  it("drops what it can't trust: a half pair, a backwards range, a non-number", () => {
    expect(parseTransferTerms({ kingdomFrom: 1201, windowStart: "2026-11-21T00:00:00Z", windowEnd: "2026-11-15T00:00:00Z", powerRegular: "150" })).toEqual(
      NO_TRANSFER_TERMS,
    );
    expect(parseTransferTerms({ kingdomFrom: 1260, kingdomTo: 1201 })).toEqual(NO_TRANSFER_TERMS);
  });

  it("treats a missing or odd value as no terms", () => {
    for (const value of [undefined, null, "", 5, [], "x"]) expect(parseTransferTerms(value)).toEqual(NO_TRANSFER_TERMS);
    expect(hasTransferTerms(NO_TRANSFER_TERMS)).toBe(false);
  });
});

describe("formatTransferWindow", () => {
  it("names both ends in UTC, whatever the visitor's zone", () => {
    expect(formatTransferWindow("2026-11-15T00:00:00.000Z", "2026-11-21T23:59:00.000Z", "en-GB")).toEqual(["Sun 15 Nov, 00:00", "Sat 21 Nov, 23:59"]);
    // 24-hour game time in every language, midnight as 00 (never 24).
    expect(formatTransferWindow("2026-11-15T00:00:00.000Z", "2026-11-21T23:59:00.000Z", "en-US")[0]).toMatch(/00:00$/);
  });
});
