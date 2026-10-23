import { describe, expect, it } from "vitest";
import type { GameEvent } from "@/lib/data/types";
import { nextOccurrence, upcomingOccurrences } from "./occurrences";

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
  guideSlug: null,
  published: true,
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
