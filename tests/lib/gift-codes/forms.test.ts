import { describe, expect, it } from "vitest";
import { MAX_REWARDS, parseGiftCodeForm } from "@/lib/gift-codes/forms";

const NOW = Date.parse("2026-10-28T19:00:00.000Z");
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [name, value] of Object.entries(fields)) fd.set(name, value);
  return fd;
};

describe("parseGiftCodeForm", () => {
  it("adds a code exactly as typed, with an optional line and expiry", () => {
    expect(parseGiftCodeForm(form({ code: " Kd1241Gift ", rewards: "200 gems", expiresAt: "2026-11-01T00:00" }), { adding: true, now: NOW })).toEqual({
      ok: true,
      value: { code: "Kd1241Gift", rewards: "200 gems", expiresAt: "2026-11-01T00:00:00.000Z" },
    });
    expect(parseGiftCodeForm(form({ code: "KS1025" }), { adding: true, now: NOW })).toEqual({ ok: true, value: { code: "KS1025", rewards: "", expiresAt: null } });
  });

  it("refuses a code with spaces, a long line, a bad date and an expiry already past", () => {
    const result = parseGiftCodeForm(form({ code: "two words", rewards: "x".repeat(MAX_REWARDS + 1), expiresAt: "2026-10-28T18:00" }), { adding: true, now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["code", "expiresAt", "rewards"]);
    const bad = parseGiftCodeForm(form({ code: "OK", expiresAt: "tomorrow" }), { adding: true, now: NOW });
    expect(bad.ok ? null : bad.errors.expiresAt).toMatch(/date and time/);
  });

  it("edits a code without its code, and lets an expiry be corrected to the past", () => {
    expect(parseGiftCodeForm(form({ code: "ignored", rewards: "Gems", expiresAt: "2026-10-01T00:00" }), { adding: false, now: NOW })).toEqual({
      ok: true,
      value: { code: null, rewards: "Gems", expiresAt: "2026-10-01T00:00:00.000Z" },
    });
  });
});
