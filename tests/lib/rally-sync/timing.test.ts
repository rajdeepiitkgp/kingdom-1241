import { describe, expect, it } from "vitest";
import {
  ceilToSecond,
  clampGameOffset,
  toGameTime,
  counterHit,
  earliestHit,
  formatSeconds,
  isTooLate,
  parseDuration,
  parseUtcClock,
  secondsUntil,
  soundCues,
  startAt,
  startStage,
  withStartTimes,
} from "@/lib/rally-sync/timing";

const at = (iso: string) => Date.parse(iso);

describe("rally sync timing", () => {
  it("starts each leader rally timer + march before the hit", () => {
    const hit = at("2026-11-07T12:10:00Z");
    expect(startAt(hit, 300, 42)).toBe(at("2026-11-07T12:04:18Z"));
    expect(startAt(hit, 300, 0)).toBe(at("2026-11-07T12:05:00Z"));
  });

  it("suggests the earliest hit from the longest march plus the buffer, on a whole second", () => {
    const now = at("2026-11-07T12:00:00.400Z");
    expect(earliestHit(now, 300, [42, 95, 61], 120)).toBe(at("2026-11-07T12:08:36Z"));
    // Buffer 0 is allowed; no leaders means only the rally timer.
    expect(earliestHit(now, 300, [95], 0)).toBe(at("2026-11-07T12:06:36Z"));
    expect(earliestHit(now, 300, [], 0)).toBe(at("2026-11-07T12:05:01Z"));
  });

  it("lands counter-rallies the offset after the enemy", () => {
    expect(counterHit(at("2026-11-07T12:30:00Z"), 3)).toBe(at("2026-11-07T12:30:03Z"));
    expect(counterHit(at("2026-11-07T12:30:00Z"), 0)).toBe(at("2026-11-07T12:30:00Z"));
  });

  it("counts down like the in-game clock: 0 during the start second", () => {
    const start = at("2026-11-07T12:04:18Z");
    expect(secondsUntil(start, start - 4300)).toBe(5);
    expect(secondsUntil(start, start - 1)).toBe(1);
    expect(secondsUntil(start, start)).toBe(0);
    expect(secondsUntil(start, start + 999)).toBe(0);
    expect(secondsUntil(start, start + 1000)).toBe(-1);
  });

  it("moves a card through waiting → ready → high alert → GO → passed", () => {
    const start = at("2026-11-07T12:04:18Z");
    expect(startStage(start, start - 61_000)).toBe("waiting");
    expect(startStage(start, start - 60_000)).toBe("ready");
    expect(startStage(start, start - 16_000)).toBe("ready");
    expect(startStage(start, start - 15_000)).toBe("alert");
    expect(startStage(start, start - 1_000)).toBe("alert");
    expect(startStage(start, start)).toBe("go");
    expect(startStage(start, start + 4_000)).toBe("go");
    expect(startStage(start, start + 5_000)).toBe("passed");
  });

  it("flags a leader whose start was over before the hit time was set", () => {
    const set = at("2026-11-07T12:00:00.500Z");
    expect(isTooLate(at("2026-11-07T12:00:00Z"), set)).toBe(true);
    expect(isTooLate(at("2026-11-07T12:00:01Z"), set)).toBe(false);
    expect(isTooLate(at("2026-11-07T11:00:00Z"), null)).toBe(false);
  });

  it("sorts the longest march (earliest start) first, then by name", () => {
    const hit = at("2026-11-07T12:10:00Z");
    const sorted = withStartTimes(
      [
        { name: "Bea", marchSeconds: 40 },
        { name: "Ada", marchSeconds: 40 },
        { name: "Cy", marchSeconds: 90 },
      ],
      hit,
      300,
    );
    expect(sorted.map((l) => l.name)).toEqual(["Cy", "Ada", "Bea"]);
    expect(sorted[0].startAt).toBe(at("2026-11-07T12:03:30Z"));
    expect(withStartTimes([{ name: "Ada", marchSeconds: 40 }], null, 300)[0].startAt).toBeNull();
  });

  it("plans a chime at 60 s, rising beeps at 5 … 1 and the GO tone at 0", () => {
    const start = at("2026-11-07T12:04:18Z");
    const cues = soundCues(start);
    expect(cues[0]).toEqual({ at: start - 60_000, kind: "chime" });
    expect(cues.filter((c) => c.kind === "tick").map((c) => [start - c.at, "step" in c ? c.step : -1])).toEqual([
      [5000, 0],
      [4000, 1],
      [3000, 2],
      [2000, 3],
      [1000, 4],
    ]);
    expect(cues.at(-1)).toEqual({ at: start, kind: "go" });
  });

  it("reads durations the way people type them", () => {
    expect(parseDuration("272")).toBe(272);
    expect(parseDuration("4:32")).toBe(272);
    expect(parseDuration(" 4 32 ")).toBe(272);
    expect(parseDuration("1:04:32")).toBe(3872);
    expect(parseDuration("0:05")).toBe(5);
    expect(parseDuration("4:75")).toBeNull();
    expect(parseDuration("-3")).toBeNull();
    expect(parseDuration("4.5")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });

  it("reads a UTC clock time as today, tomorrow after midnight, and keeps a just-passed time for an error", () => {
    const now = at("2026-11-07T14:00:00Z");
    expect(parseUtcClock("14:30:00", now)).toBe(at("2026-11-07T14:30:00Z"));
    expect(parseUtcClock("14.30", now)).toBe(at("2026-11-07T14:30:00Z"));
    expect(parseUtcClock("143005", now)).toBe(at("2026-11-07T14:30:05Z"));
    expect(parseUtcClock("1430", now)).toBe(at("2026-11-07T14:30:00Z"));
    expect(parseUtcClock("13:30:00", now)).toBe(at("2026-11-07T13:30:00Z"));
    expect(parseUtcClock("00:05", at("2026-11-07T23:50:00Z"))).toBe(at("2026-11-08T00:05:00Z"));
    expect(parseUtcClock("24:00", now)).toBeNull();
    expect(parseUtcClock("14:3", now)).toBeNull();
    expect(parseUtcClock("soon", now)).toBeNull();
  });

  it("counts down on each device's game clock to the same game-clock start", () => {
    // The game clock is the reference: the start is a game time, the same for everyone.
    const start = at("2026-11-07T12:04:18Z");
    const trueNow = at("2026-11-07T12:04:00Z");
    // A player whose game clock runs 2 s ahead of UTC reaches the start 2 s earlier in real time.
    expect(secondsUntil(start, toGameTime(trueNow, 2))).toBe(16);
    expect(secondsUntil(start, toGameTime(trueNow, 0))).toBe(18);
    expect(secondsUntil(start, toGameTime(trueNow, -3))).toBe(21);
    expect(clampGameOffset(2.4)).toBe(2);
    expect(clampGameOffset(500)).toBe(60);
    expect(clampGameOffset(-500)).toBe(-60);
    expect(clampGameOffset("3")).toBe(0);
    expect(clampGameOffset(undefined)).toBe(0);
  });

  it("formats seconds as m:ss or h:mm:ss", () => {
    expect(formatSeconds(42)).toBe("0:42");
    expect(formatSeconds(272)).toBe("4:32");
    expect(formatSeconds(3723)).toBe("1:02:03");
    expect(formatSeconds(-5)).toBe("-0:05");
    expect(ceilToSecond(1_000_001)).toBe(1_001_000);
  });
});
