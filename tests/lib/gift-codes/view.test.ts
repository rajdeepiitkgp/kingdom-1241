import { describe, expect, it } from "vitest";
import type { GiftCode } from "@/lib/data/types";
import { giftCodeView } from "@/lib/gift-codes/view";

const code: GiftCode = {
  id: "g1",
  code: "KS2026",
  rewards: { en: "100 gems", ko: "보석 100개" },
  expiresAt: null,
  active: true,
  addedAt: "2026-10-30T00:00:00.000Z",
  source: "kingshot",
  endedAt: null,
};

describe("giftCodeView", () => {
  it("keeps the visitor's language only and falls back to English", () => {
    expect(giftCodeView(code, "ko")).toMatchObject({ code: "KS2026", rewards: "보석 100개" });
    expect(giftCodeView(code, "de").rewards).toBe("100 gems");
  });
});
