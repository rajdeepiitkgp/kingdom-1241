// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { parseGiftCodeFeed } from "@/lib/gift-codes/kingshot";

// The shape kingshot.net answered with on 28 Oct 2026.
const FEED = {
  status: "success",
  data: {
    giftCodes: [
      { id: 158, code: "KS1025", expiresAt: null, createdAt: "2026-10-25T05:21:23.252Z" },
      { id: 157, code: "OFFICIALSTORE1023", expiresAt: "2026-11-15T00:00:00Z", createdAt: "2026-10-23T12:01:09.549Z" },
    ],
    total: 145,
    activeCount: 2,
    expiredCount: 143,
  },
  message: "Gift codes retrieved successfully",
  meta: null,
  timestamp: "2026-10-28T19:07:20.543Z",
};

describe("parseGiftCodeFeed", () => {
  it("reads kingshot.net's list of working codes", () => {
    expect(parseGiftCodeFeed(FEED)).toEqual([
      { code: "KS1025", expiresAt: null, createdAt: "2026-10-25T05:21:23.252Z" },
      { code: "OFFICIALSTORE1023", expiresAt: "2026-11-15T00:00:00.000Z", createdAt: "2026-10-23T12:01:09.549Z" },
    ]);
  });

  it("takes an empty list as no codes", () => {
    expect(parseGiftCodeFeed({ status: "success", data: { giftCodes: [] } })).toEqual([]);
  });

  it("refuses an answer that isn't the list, so a new format never ends every code", () => {
    for (const answer of [null, "oops", [], { status: "error", data: { giftCodes: [] } }, { status: "success", data: { codes: [] } }, { status: "success" }]) {
      expect(parseGiftCodeFeed(answer), JSON.stringify(answer)).toBeNull();
    }
  });

  it("skips entries that aren't a code, keeps the case and drops repeats", () => {
    const codes = parseGiftCodeFeed({
      status: "success",
      data: { giftCodes: [{ code: " Kd1241 " }, { code: "Kd1241" }, { code: "kd1241" }, { code: "two words" }, { code: "" }, { code: 42 }, null, { code: "OK", expiresAt: "not a date" }] },
    });
    expect(codes?.map((c) => c.code)).toEqual(["Kd1241", "kd1241", "OK"]);
    expect(codes?.at(-1)).toEqual({ code: "OK", expiresAt: null, createdAt: null });
  });
});
