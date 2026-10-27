// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import {
  formatRoomCode,
  joinStatus,
  leaderEdit,
  nextRallyMarch,
  rallyRunning,
  resyncMarches,
  statusAfter,
  HISTORY_LENGTH,
  isRoomOpen,
  normalizeRoomCode,
  parseHistory,
  parseMarch,
  parseName,
  parsePassword,
  parseSettings,
  parseTitle,
  pushHistory,
  randomRoomCode,
  ROOM_CODE_ALPHABET,
  roomClosesAt,
  startChanged,
} from "@/lib/rally-sync/room";

describe("rally sync rooms", () => {
  it("draws codes from the unambiguous alphabet only, skipping biased bytes", () => {
    const bytes = [255, 250, 0, 1, 2, 3, 4, 30, 31];
    let i = 0;
    const code = randomRoomCode(() => bytes[i++]);
    // 255 and 250 are above the last full cycle of 31 (248) and are skipped.
    expect(code).toBe("ABCDE9");
    expect([...code].every((c) => ROOM_CODE_ALPHABET.includes(c))).toBe(true);
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[01IOL]/);
  });

  it("accepts a code typed in lower case, with spaces or a dash", () => {
    expect(normalizeRoomCode("k7m 4qx")).toBe("K7M4QX");
    expect(normalizeRoomCode("K7M-4QX")).toBe("K7M4QX");
    expect(normalizeRoomCode("K7M4Q0")).toBeNull(); // 0 is not in the alphabet
    expect(normalizeRoomCode("K7M4")).toBeNull();
    expect(normalizeRoomCode(undefined)).toBeNull();
    expect(formatRoomCode("K7M4QX")).toBe("K7M 4QX");
  });

  it("closes a room after 30 minutes without anybody, or a day after it was created", () => {
    const room = { createdAt: "2026-11-07T10:00:00Z", lastSeenAt: "2026-11-07T12:00:00Z" };
    expect(roomClosesAt(room)).toBe(Date.parse("2026-11-07T12:30:00Z"));
    expect(isRoomOpen(room, Date.parse("2026-11-07T12:29:59Z"))).toBe(true);
    expect(isRoomOpen(room, Date.parse("2026-11-07T12:30:00Z"))).toBe(false);
    const old = { createdAt: "2026-11-06T12:10:00Z", lastSeenAt: "2026-11-07T12:00:00Z" };
    expect(roomClosesAt(old)).toBe(Date.parse("2026-11-07T12:10:00Z"));
  });

  it("keeps the last ten hit times, newest first, and ignores junk", () => {
    const history = Array.from({ length: HISTORY_LENGTH }, (_, i) => ({ hitAt: `h${i}`, setAt: `s${i}` }));
    const next = pushHistory(history, { hitAt: "new", setAt: "now" });
    expect(next).toHaveLength(HISTORY_LENGTH);
    expect(next[0].hitAt).toBe("new");
    expect(next.at(-1)?.hitAt).toBe("h8");
    expect(pushHistory(history, null)).toEqual(history);
    expect(parseHistory([{ hitAt: "a", setAt: "b" }, { hitAt: 1 }, "x"])).toEqual([{ hitAt: "a", setAt: "b" }]);
    expect(parseHistory(null)).toEqual([]);
  });

  it("flags a changed start only when the march changed after the hit time was set", () => {
    const leader = { marchSeconds: 50, previousMarchSeconds: 42, marchChangedAt: "2026-11-07T12:05:00Z" };
    expect(startChanged(leader, "2026-11-07T12:00:00Z")).toBe(true);
    // A new hit time clears the flag.
    expect(startChanged(leader, "2026-11-07T12:06:00Z")).toBe(false);
    expect(startChanged({ ...leader, previousMarchSeconds: 50 }, "2026-11-07T12:00:00Z")).toBe(false);
    expect(startChanged(leader, null)).toBe(false);
  });

  it("checks names, titles and passwords", () => {
    expect(parseName("  Big   Bear  ")).toEqual({ ok: true, value: "Big Bear" });
    expect(parseName("")).toEqual({ ok: false });
    expect(parseName("x".repeat(31))).toEqual({ ok: false });
    expect(parseTitle("")).toEqual({ ok: true, value: "" });
    expect(parseTitle("x".repeat(41))).toEqual({ ok: false });
    expect(parsePassword(" castle ")).toEqual({ ok: true, value: "castle" });
    expect(parsePassword("short")).toEqual({ ok: false });
  });

  it("adds optional minutes to the march seconds (1 s – 1 h)", () => {
    expect(parseMarch("42")).toEqual({ ok: true, value: 42 });
    expect(parseMarch(42)).toEqual({ ok: true, value: 42 });
    expect(parseMarch("12", "1")).toEqual({ ok: true, value: 72 });
    expect(parseMarch("", "2")).toEqual({ ok: true, value: 120 });
    expect(parseMarch("0")).toEqual({ ok: false });
    expect(parseMarch("", "")).toEqual({ ok: false });
    expect(parseMarch("3601")).toEqual({ ok: false });
    expect(parseMarch("4.5")).toEqual({ ok: false });
    expect(parseMarch(undefined)).toEqual({ ok: false });
  });

  it("keeps the coordinator's settings in range", () => {
    expect(parseSettings({ mode: "counter", rallyWaitSeconds: 300, bufferSeconds: 0, counterOffsetSeconds: 10 })).toEqual({
      ok: true,
      value: { mode: "counter", rallyWaitSeconds: 300, bufferSeconds: 0, counterOffsetSeconds: 10 },
    });
    expect(parseSettings({ mode: "rally", rallyWaitSeconds: "60", bufferSeconds: "120", counterOffsetSeconds: "3" }).ok).toBe(true);
    expect(parseSettings({ mode: "rally", rallyWaitSeconds: 5, bufferSeconds: 0, counterOffsetSeconds: 3 }).ok).toBe(false);
    expect(parseSettings({ mode: "rally", rallyWaitSeconds: 300, bufferSeconds: 601, counterOffsetSeconds: 3 }).ok).toBe(false);
    expect(parseSettings({ mode: "rally", rallyWaitSeconds: 300, bufferSeconds: 0, counterOffsetSeconds: 11 }).ok).toBe(false);
    expect(parseSettings({ mode: "garrison", rallyWaitSeconds: 300, bufferSeconds: 0, counterOffsetSeconds: 3 }).ok).toBe(false);
  });

  it("knows when a rally is running and which march time the next hit time uses", () => {
    const now = Date.parse("2026-11-07T12:00:00Z");
    expect(rallyRunning("2026-11-07T12:05:00Z", now)).toBe(true);
    expect(rallyRunning("2026-11-07T12:00:00Z", now)).toBe(false);
    expect(rallyRunning(null, now)).toBe(false);
    expect(nextRallyMarch({ marchSeconds: 50, nextMarchSeconds: 80 })).toBe(80);
    expect(nextRallyMarch({ marchSeconds: 50, nextMarchSeconds: null })).toBe(50);
  });

  it("keeps a leader's own march change for the next rally while one is running", () => {
    const at = "2026-11-07T12:01:00Z";
    const leader = { marchSeconds: 50, nextMarchSeconds: null, status: "active" as const };
    // During a rally: the start doesn't move, the new value waits.
    expect(leaderEdit(leader, { name: "Bear", marchSeconds: 80 }, { running: true, byCoordinator: false, at })).toEqual({ name: "Bear", nextMarchSeconds: 80 });
    // Typing the current value again cancels a waiting one.
    expect(leaderEdit({ marchSeconds: 50, nextMarchSeconds: 80, status: "active" }, { name: "Bear", marchSeconds: 50 }, { running: true, byCoordinator: false, at })).toEqual({
      name: "Bear",
      nextMarchSeconds: null,
    });
    // No rally running: it applies at once and drops a waiting value.
    expect(leaderEdit({ marchSeconds: 50, nextMarchSeconds: 80, status: "active" }, { name: "Bear", marchSeconds: 90 }, { running: false, byCoordinator: false, at })).toEqual({
      name: "Bear",
      marchSeconds: 90,
      nextMarchSeconds: null,
    });
  });

  it("applies the coordinator's march change at once, flagged during a rally, and keeps a waiting value on a name fix", () => {
    const at = "2026-11-07T12:01:00Z";
    expect(leaderEdit({ marchSeconds: 50, nextMarchSeconds: null, status: "active" }, { name: "Bear", marchSeconds: 80 }, { running: true, byCoordinator: true, at })).toEqual({
      name: "Bear",
      marchSeconds: 80,
      nextMarchSeconds: null,
      previousMarchSeconds: 50,
      marchChangedAt: at,
    });
    expect(leaderEdit({ marchSeconds: 50, nextMarchSeconds: 80, status: "active" }, { name: "Big Bear", marchSeconds: 50 }, { running: true, byCoordinator: true, at })).toEqual({
      name: "Big Bear",
      marchSeconds: 50,
      nextMarchSeconds: 80,
    });
    expect(leaderEdit({ marchSeconds: 50, nextMarchSeconds: 80, status: "active" }, { name: "Bear", marchSeconds: 70 }, { running: false, byCoordinator: true, at })).toEqual({
      name: "Bear",
      marchSeconds: 70,
      nextMarchSeconds: null,
    });
  });

  it("lets a leader who isn't in the running rally change their march time at once", () => {
    const at = "2026-11-07T12:01:00Z";
    for (const status of ["next", "inactive"] as const) {
      expect(leaderEdit({ marchSeconds: 50, nextMarchSeconds: null, status }, { name: "Bear", marchSeconds: 80 }, { running: true, byCoordinator: false, at })).toEqual({
        name: "Bear",
        marchSeconds: 80,
        nextMarchSeconds: null,
      });
    }
  });

  it("puts joiners and returners during a rally into the next one, and sits out at once", () => {
    expect(joinStatus(true)).toBe("next");
    expect(joinStatus(false)).toBe("active");
    // Sitting out applies at once, rally or not.
    expect(statusAfter("active", false, true)).toBe("inactive");
    expect(statusAfter("next", false, false)).toBe("inactive");
    // Coming back: in at once before a rally, from the next one during it.
    expect(statusAfter("inactive", true, false)).toBe("active");
    expect(statusAfter("inactive", true, true)).toBe("next");
    // Already in: nothing changes.
    expect(statusAfter("active", true, true)).toBe("active");
    expect(statusAfter("next", true, false)).toBe("next");
  });

  it("plans Re-sync with everyone but those sitting out, using next-rally march times", () => {
    expect(
      resyncMarches([
        { marchSeconds: 50, nextMarchSeconds: 120, status: "active" },
        { marchSeconds: 95, nextMarchSeconds: null, status: "next" },
        { marchSeconds: 300, nextMarchSeconds: null, status: "inactive" },
      ]),
    ).toEqual([120, 95]);
  });
});
