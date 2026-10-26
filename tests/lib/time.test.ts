import { describe, expect, it } from "vitest";
import { DAY, formatLocalTime, formatUtcClock, formatUtcDate, formatUtcRange, formatUtcTime, HOUR, localTimeZone, MINUTE, nextDailyReset, pad2, splitDuration } from "@/lib/time";

describe("nextDailyReset", () => {
  it("is the next 00:00 UTC, never the current moment", () => {
    expect(nextDailyReset(new Date("2026-10-24T10:00:00Z")).toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(nextDailyReset(new Date("2026-10-24T00:00:00Z")).toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(nextDailyReset(new Date("2026-10-23T23:59:59Z")).toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });

  it("honours a different reset hour and rolls over months", () => {
    expect(nextDailyReset(new Date("2026-10-31T01:00:00Z"), 2).toISOString()).toBe("2026-10-31T02:00:00.000Z");
    expect(nextDailyReset(new Date("2026-10-31T03:00:00Z"), 2).toISOString()).toBe("2026-11-01T02:00:00.000Z");
  });
});

describe("splitDuration", () => {
  it("splits into days, hours, minutes and whole seconds", () => {
    expect(splitDuration(2 * DAY + 5 * HOUR + 13 * MINUTE + 9_500)).toEqual({ days: 2, hours: 5, minutes: 13, seconds: 9, totalMs: 2 * DAY + 5 * HOUR + 13 * MINUTE + 9_500 });
  });
  it("clamps negative durations to zero", () => {
    expect(splitDuration(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 });
  });
});

describe("UTC formatters", () => {
  const at = new Date("2026-10-23T13:05:09Z");
  it("pad and format clocks in UTC regardless of the machine's zone", () => {
    expect(pad2(7)).toBe("07");
    expect(pad2(12)).toBe("12");
    expect(formatUtcClock(at)).toBe("13:05:09");
    expect(formatUtcTime(at)).toBe("13:05 UTC");
  });
  it("names the weekday and month in the visitor's language", () => {
    expect(formatUtcDate(at, "en-GB")).toMatch(/Fri.*23.*Oct/);
    expect(formatUtcDate(at, "de")).toMatch(/Fr\.?.*23.*Okt/);
  });
  it("formats a battle span in UTC, with both days when it crosses midnight", () => {
    expect(formatUtcRange(new Date("2026-10-24T12:00:00Z"), new Date("2026-10-24T17:00:00Z"))).toBe("12:00–17:00 UTC");
    expect(formatUtcRange(new Date("2026-10-24T22:00:00Z"), new Date("2026-10-25T03:00:00Z"))).toBe("22:00 UTC – 03:00 UTC");
  });
  it("formats a local clock time without the date", () => {
    expect(formatLocalTime(at, "en")).toMatch(/^\d{2}:\d{2}/);
  });
  it("always returns a time zone name", () => {
    expect(typeof localTimeZone()).toBe("string");
    expect(localTimeZone().length).toBeGreaterThan(0);
  });
});
