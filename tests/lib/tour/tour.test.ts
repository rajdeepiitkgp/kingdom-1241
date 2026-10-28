// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { cardSide, hasSeen, markSeen, parseSeen, resolveSteps, scrollDelta, TOUR_GAP, uiStep } from "@/lib/tour/tour";

const tour = { id: "sync-rally", version: 2 };

describe("which tours this device has seen", () => {
  it("reads the stored versions and ignores anything unreadable", () => {
    expect(parseSeen('{"sync-rally":1,"sync-counter":3}')).toEqual({ "sync-rally": 1, "sync-counter": 3 });
    expect(parseSeen('{"a":"1","b":0,"c":1.5,"d":2}')).toEqual({ d: 2 });
    for (const raw of [null, "", "not json", "[1]", "null", "7"]) expect(parseSeen(raw)).toEqual({});
  });

  it("counts a tour as seen only from its current version, so new steps bring the line back", () => {
    expect(hasSeen({}, tour)).toBe(false);
    expect(hasSeen({ "sync-rally": 1 }, tour)).toBe(false);
    expect(hasSeen({ "sync-rally": 2 }, tour)).toBe(true);
    expect(hasSeen({ "sync-rally": 3 }, tour)).toBe(true);
  });

  it("marks a version without lowering a newer one or touching other tours", () => {
    expect(markSeen({ other: 4 }, tour)).toEqual({ other: 4, "sync-rally": 2 });
    expect(markSeen({ "sync-rally": 5 }, tour)).toEqual({ "sync-rally": 5 });
  });
});

describe("placing a step", () => {
  const band = { top: 84, bottom: 500 };

  it("leaves an element alone when it already sits in the free band", () => {
    expect(scrollDelta({ top: 100, bottom: 300 }, band)).toBe(0);
  });

  it("centres an element that fits, from below or from above", () => {
    // 100 px tall in a 416 px band: its top should land at 84 + 158 = 242.
    expect(scrollDelta({ top: 900, bottom: 1000 }, band)).toBe(658);
    expect(scrollDelta({ top: -300, bottom: -200 }, band)).toBe(-542);
  });

  it("puts the top of an element taller than the band at the band's top", () => {
    expect(scrollDelta({ top: 700, bottom: 1400 }, band)).toBe(616);
  });

  it("keeps the card at the bottom unless the element runs under it while the top is free", () => {
    expect(cardSide({ top: 100, bottom: 400 }, 800, 300)).toBe("bottom");
    expect(cardSide({ top: 100, bottom: 800 - 300 - TOUR_GAP }, 800, 300)).toBe("bottom");
    // The last part of the page: scrolling stopped with the element low on the screen.
    expect(cardSide({ top: 560, bottom: 760 }, 800, 300)).toBe("top");
    // Too tall for either side: the bottom, where the card always starts.
    expect(cardSide({ top: 200, bottom: 780 }, 800, 300)).toBe("bottom");
  });
});

describe("steps from UI strings", () => {
  it("pairs a title and a body key and resolves them in the visitor's language", () => {
    const step = uiStep("sync-status", "sync.status");
    expect(step).toEqual({ target: "sync-status", title: "tour.sync.status.title", body: "tour.sync.status.body" });
    const dict = { "tour.sync.status.title": "Dieser Raum", "tour.sync.status.body": "Name und ID." } as Dictionary;
    expect(resolveSteps({ id: "x", version: 1, steps: [step] }, dict)).toEqual([{ target: "sync-status", title: "Dieser Raum", body: "Name und ID." }]);
  });
});
