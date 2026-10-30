import { describe, expect, it } from "vitest";
import type { GameEvent } from "@/lib/data/types";
import { eventView } from "@/lib/events/view";

const event: GameEvent = {
  id: "e1",
  slug: "bear-hunt",
  name: { en: "Bear Hunt", de: "Bärenjagd" },
  summary: { en: "Rally the bear.", de: "Den Bären sammeln." },
  category: "alliance",
  icon: "🐻",
  color: "amber",
  startsAt: "2026-11-03T00:00:00.000Z",
  durationMinutes: 1440,
  repeatEveryDays: 7,
  alsoAfterDays: null,
  timing: "alliance",
  guideSlug: null,
  published: true,
};

describe("eventView", () => {
  it("keeps the visitor's language only and falls back to English", () => {
    expect(eventView(event, "de")).toMatchObject({ id: "e1", name: "Bärenjagd", summary: "Den Bären sammeln.", repeatEveryDays: 7 });
    expect(eventView(event, "pl")).toMatchObject({ name: "Bear Hunt", summary: "Rally the bear." });
  });
});
