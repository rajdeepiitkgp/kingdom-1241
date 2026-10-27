import { describe, expect, it } from "vitest";
import {
  formatRoomCode,
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
});
