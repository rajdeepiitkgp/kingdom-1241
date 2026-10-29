import { describe, expect, it } from "vitest";
import type { GameEvent } from "@/lib/data/types";
import { daysUntil, nextOccurrence, roundWeekdays, upcomingOccurrences } from "@/lib/events/occurrences";

const base: GameEvent = {
  id: "1",
  slug: "bear",
  name: { en: "Bear Hunt" },
  summary: { en: "" },
  category: "alliance",
  icon: "🐻",
  color: "amber",
  startsAt: "2026-10-24T12:00:00.000Z",
  durationMinutes: 30,
  repeatEveryDays: 2,
  alsoAfterDays: null,
  timing: "fixed",
  guideSlug: null,
  published: true,
};

/** Viking Vengeance: each alliance picks its times, every two weeks on a Tuesday and the Thursday after. */
const viking: GameEvent = {
  ...base,
  id: "4",
  slug: "viking",
  startsAt: "2026-11-03T00:00:00.000Z",
  durationMinutes: 60,
  repeatEveryDays: 14,
  alsoAfterDays: 2,
  timing: "alliance",
};

describe("nextOccurrence", () => {
  it("returns the first occurrence before it starts", () => {
    const o = nextOccurrence(base, new Date("2026-10-20T00:00:00Z"))!;
    expect(o.start.toISOString()).toBe("2026-10-24T12:00:00.000Z");
    expect(o.status).toBe("upcoming");
  });

  it("reports a live occurrence", () => {
    const o = nextOccurrence(base, new Date("2026-10-24T12:10:00Z"))!;
    expect(o.status).toBe("live");
    expect(o.end.toISOString()).toBe("2026-10-24T12:30:00.000Z");
  });

  it("rolls a recurring event forward to the next occurrence", () => {
    const o = nextOccurrence(base, new Date("2026-10-24T12:31:00Z"))!;
    expect(o.start.toISOString()).toBe("2026-10-26T12:00:00.000Z");
    const later = nextOccurrence(base, new Date("2026-11-30T23:00:00Z"))!;
    expect(later.start.toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });

  it("returns null for a one-off event that has ended", () => {
    const once = { ...base, repeatEveryDays: null };
    expect(nextOccurrence(once, new Date("2026-10-24T13:00:00Z"))).toBeNull();
    expect(nextOccurrence(once, new Date("2026-10-24T12:29:00Z"))?.status).toBe("live");
  });
});

describe("upcomingOccurrences", () => {
  it("puts live events first, then sorts by start time", () => {
    const later = { ...base, id: "2", slug: "later", startsAt: "2026-10-24T13:00:00.000Z", repeatEveryDays: null };
    const live = { ...base, id: "3", slug: "live", startsAt: "2026-10-24T12:20:00.000Z", repeatEveryDays: null };
    const now = new Date("2026-10-24T12:31:00Z"); // base's first occurrence just ended → rolls to 26th
    const list = upcomingOccurrences([base, later, live], now);
    expect(list.map((o) => o.event.slug)).toEqual(["live", "later", "bear"]);
    expect(upcomingOccurrences([base, later, live], now, 1)).toHaveLength(1);
  });
});

describe("rounds with a second day", () => {
  it("goes from the first day to the second, then to the next round", () => {
    const fixed = { ...viking, timing: "fixed" as const, startsAt: "2026-11-03T19:00:00.000Z" };
    expect(nextOccurrence(fixed, new Date("2026-11-03T20:01:00Z"))!.start.toISOString()).toBe("2026-11-05T19:00:00.000Z");
    expect(nextOccurrence(fixed, new Date("2026-11-05T20:01:00Z"))!.start.toISOString()).toBe("2026-11-17T19:00:00.000Z");
    expect(nextOccurrence(fixed, new Date("2026-11-05T19:30:00Z"))!.status).toBe("live");
  });

  it("finds the second day of an earlier round, not only of the current one", () => {
    // Round 2 begins on 17 Nov; on 18 Nov the next day is its Thursday (19 Nov).
    expect(nextOccurrence(viking, new Date("2026-11-18T08:00:00Z"))!.start.toISOString()).toBe("2026-11-19T00:00:00.000Z");
  });
});

describe("events each alliance times itself", () => {
  it("are a whole UTC day, whatever time was stored", () => {
    const hunt = { ...base, timing: "alliance" as const };
    const today = nextOccurrence(hunt, new Date("2026-10-24T23:30:00Z"))!;
    expect(today.start.toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(today.status).toBe("live");
    expect(nextOccurrence(hunt, new Date("2026-10-25T00:00:01Z"))!.start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("count in calendar days", () => {
    const start = new Date("2026-11-05T00:00:00Z");
    expect(daysUntil(start, new Date("2026-11-05T22:00:00Z"))).toBe(0);
    expect(daysUntil(start, new Date("2026-11-04T23:59:00Z"))).toBe(1);
    expect(daysUntil(start, new Date("2026-11-02T01:00:00Z"))).toBe(3);
  });
});

describe("roundWeekdays", () => {
  it("names both days of a weekly round in the visitor's language", () => {
    expect(roundWeekdays(viking, "en")).toBe("Tue + Thu");
    expect(roundWeekdays(viking, "de")).toMatch(/^Di\.? \+ Do\.?$/);
  });

  it("stays quiet when the weekdays would drift or there is one day", () => {
    expect(roundWeekdays({ ...viking, repeatEveryDays: 10 }, "en")).toBeNull();
    expect(roundWeekdays({ ...viking, alsoAfterDays: null }, "en")).toBeNull();
  });
});
