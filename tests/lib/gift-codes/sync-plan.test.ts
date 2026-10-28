// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FeedCode } from "@/lib/gift-codes/kingshot";
import {
  feedStale,
  giftCodeState,
  HOURLY_CHECK_MINUTE,
  NO_CHECK_YET,
  nextSyncState,
  parseGiftCodeSyncState,
  planChangesHome,
  planGiftCodeSync,
  type StoredGiftCode,
} from "@/lib/gift-codes/sync-plan";
import { DAY, HOUR } from "@/lib/time";

const NOW = Date.parse("2026-10-28T19:23:00.000Z");
const at = (iso: string) => new Date(iso).toISOString();
const feed = (code: string, extra: Partial<FeedCode> = {}): FeedCode => ({ code, expiresAt: null, createdAt: "2026-10-25T05:21:23.252Z", ...extra });
const row = (id: string, code: string, extra: Partial<StoredGiftCode> = {}): StoredGiftCode => ({ id, code, source: "kingshot", expiresAt: null, endedAt: null, ...extra });

describe("planGiftCodeSync", () => {
  it("adds a code kingshot.net lists for the first time, dated when kingshot.net added it", () => {
    const plan = planGiftCodeSync([row("a", "KS1025")], [feed("KS1025"), feed("NEW1", { expiresAt: at("2026-11-01T00:00:00Z") })], NOW);
    expect(plan.inserts).toEqual([{ code: "NEW1", expiresAt: "2026-11-01T00:00:00.000Z", addedAt: "2026-10-25T05:21:23.252Z" }]);
    expect(plan).toMatchObject({ updates: [], ends: [], deletes: [] });
    expect(planChangesHome(plan)).toBe(true);
  });

  it("dates a code now when kingshot.net gives no date or one ahead of us", () => {
    const plan = planGiftCodeSync([], [feed("A", { createdAt: null }), feed("B", { createdAt: "2026-12-01T00:00:00.000Z" })], NOW);
    expect(plan.inserts.map((i) => i.addedAt)).toEqual([at("2026-10-28T19:23:00Z"), at("2026-10-28T19:23:00Z")]);
  });

  it("changes nothing when the list is the same", () => {
    const plan = planGiftCodeSync([row("a", "KS1025"), row("b", "MINE", { source: "manual" })], [feed("KS1025")], NOW);
    expect(plan).toEqual({ inserts: [], updates: [], ends: [], deletes: [] });
    expect(planChangesHome(plan)).toBe(false);
  });

  it("ends a code from kingshot.net once it leaves the list, but never a moderator's own", () => {
    const plan = planGiftCodeSync([row("a", "OLD"), row("b", "MINE", { source: "manual" })], [], NOW);
    expect(plan.ends.map((r) => r.code)).toEqual(["OLD"]);
  });

  it("takes over a code a moderator added once kingshot.net lists it", () => {
    const plan = planGiftCodeSync([row("b", "MINE", { source: "manual" })], [feed("MINE")], NOW);
    expect(plan.updates).toEqual([{ id: "b", code: "MINE", changes: { source: "kingshot" } }]);
    expect(plan.inserts).toEqual([]);
  });

  it("brings back an ended code that is listed again", () => {
    const plan = planGiftCodeSync([row("a", "BLIP", { endedAt: at("2026-10-28T18:23:00Z") })], [feed("BLIP")], NOW);
    expect(plan.updates).toEqual([{ id: "a", code: "BLIP", changes: { endedAt: null } }]);
  });

  it("takes kingshot.net's expiry when it has one, and keeps a typed one while it has none", () => {
    const typed = at("2026-11-30T00:00:00Z");
    const theirs = at("2026-11-15T00:00:00Z");
    expect(planGiftCodeSync([row("a", "A", { expiresAt: typed })], [feed("A", { expiresAt: theirs })], NOW).updates).toEqual([{ id: "a", code: "A", changes: { expiresAt: theirs } }]);
    expect(planGiftCodeSync([row("a", "A", { expiresAt: typed })], [feed("A")], NOW).updates).toEqual([]);
    expect(planGiftCodeSync([row("a", "A", { expiresAt: theirs })], [feed("A", { expiresAt: theirs })], NOW).updates).toEqual([]);
  });

  it("matches codes exactly: they are case-sensitive", () => {
    const plan = planGiftCodeSync([row("a", "Kd1241")], [feed("KD1241")], NOW);
    expect(plan.inserts.map((i) => i.code)).toEqual(["KD1241"]);
    expect(plan.ends.map((r) => r.code)).toEqual(["Kd1241"]);
  });

  it("deletes codes 30 days after they ended or expired, and nothing listed or still working", () => {
    const stored = [
      row("a", "ENDED31", { endedAt: new Date(NOW - 31 * DAY).toISOString() }),
      row("b", "ENDED29", { endedAt: new Date(NOW - 29 * DAY).toISOString() }),
      row("c", "EXPIRED31", { source: "manual", expiresAt: new Date(NOW - 31 * DAY).toISOString() }),
      row("d", "LATER", { source: "manual", expiresAt: new Date(NOW + DAY).toISOString() }),
      row("e", "MINE", { source: "manual" }),
      row("f", "BACK", { endedAt: new Date(NOW - 40 * DAY).toISOString() }),
    ];
    expect(planGiftCodeSync(stored, [feed("BACK")], NOW).deletes.map((r) => r.code)).toEqual(["ENDED31", "EXPIRED31"]);
  });
});

describe("giftCodeState", () => {
  const code = { active: true, endedAt: null, expiresAt: null };
  it("shows a code on Home only while it is not hidden, ended or expired", () => {
    expect(giftCodeState(code, NOW)).toBe("home");
    expect(giftCodeState({ ...code, active: false }, NOW)).toBe("hidden");
    expect(giftCodeState({ ...code, expiresAt: new Date(NOW).toISOString() }, NOW)).toBe("expired");
    expect(giftCodeState({ ...code, expiresAt: new Date(NOW + 1000).toISOString() }, NOW)).toBe("home");
    expect(giftCodeState({ ...code, active: false, endedAt: new Date(NOW - HOUR).toISOString(), expiresAt: new Date(NOW - DAY).toISOString() }, NOW)).toBe("ended");
  });
});

describe("the check's state", () => {
  it("remembers the last good check through a failed one", () => {
    const good = nextSyncState(NO_CHECK_YET, 2, "2026-10-28T18:23:00.000Z", "hourly");
    expect(good).toEqual({ at: "2026-10-28T18:23:00.000Z", ok: true, by: "hourly", okAt: "2026-10-28T18:23:00.000Z", listed: 2 });
    expect(nextSyncState(good, null, "2026-10-28T19:23:00.000Z", "now")).toEqual({ at: "2026-10-28T19:23:00.000Z", ok: false, by: "now", okAt: "2026-10-28T18:23:00.000Z", listed: 2 });
  });

  it("calls kingshot.net stale after six hours without a good check, or before the first", () => {
    expect(feedStale(NO_CHECK_YET, NOW)).toBe(true);
    expect(feedStale({ ...NO_CHECK_YET, okAt: new Date(NOW - 5 * HOUR).toISOString() }, NOW)).toBe(false);
    expect(feedStale({ ...NO_CHECK_YET, okAt: new Date(NOW - 6 * HOUR).toISOString() }, NOW)).toBe(true);
  });

  it("reads a stored state tolerantly", () => {
    expect(parseGiftCodeSyncState(null)).toEqual(NO_CHECK_YET);
    expect(parseGiftCodeSyncState({ at: "2026-10-28T18:23:00.000Z", ok: true, by: "cron", okAt: "nope", listed: -1 })).toEqual({
      at: "2026-10-28T18:23:00.000Z",
      ok: true,
      by: null,
      okAt: null,
      listed: 0,
    });
  });

  it("names the minute of the Gift codes workflow's hourly run", () => {
    expect(readFileSync(".github/workflows/gift-codes.yml", "utf8")).toContain(`cron: "${HOURLY_CHECK_MINUTE} * * * *"`);
  });
});
