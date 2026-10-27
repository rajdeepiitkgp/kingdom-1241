// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { counterOrder } from "@/lib/rally-sync/counter";

const leader = (name: string, marchSeconds: number, status: "active" | "next" | "inactive" = "active") => ({ name, marchSeconds, status });

describe("the counter-rally launch order", () => {
  it("starts the slowest march first and cues everyone else off the earlier rallies' countdowns", () => {
    const steps = counterOrder([leader("Tom", 40), leader("Rajx", 52), leader("Mira", 45)], 300);
    expect(steps.map((s) => [s.position, s.leader.name])).toEqual([
      [1, "Rajx"],
      [2, "Mira"],
      [3, "Tom"],
    ]);
    expect(steps[0]).toMatchObject({ first: null, previous: null });
    // Mira starts 7 s after Rajx: when Rajx's 5:00 countdown shows 4:53. Everyone lands in the same second.
    expect(steps[1]).toMatchObject({ first: { name: "Rajx", seconds: 293, gapSeconds: 7 }, previous: null });
    // Tom has two references, so a slip by Mira doesn't carry over: Rajx's 4:48 or Mira's 4:55.
    expect(steps[2]).toMatchObject({ first: { name: "Rajx", seconds: 288, gapSeconds: 12 }, previous: { name: "Mira", seconds: 295, gapSeconds: 5 } });
  });

  it("leaves out leaders sitting out and starts equal marches together", () => {
    const steps = counterOrder([leader("Bea", 45), leader("Out", 60, "inactive"), leader("Ali", 45), leader("New", 30, "next")], 10);
    expect(steps.map((s) => s.leader.name)).toEqual(["Ali", "Bea", "New"]);
    expect(steps[1].first).toEqual({ name: "Ali", seconds: 10, gapSeconds: 0 });
    // A gap longer than a 0:10 timer: Ali's countdown has run out by then, so New counts 15 s after Ali started.
    expect(steps[2].first).toEqual({ name: "Ali", seconds: -5, gapSeconds: 15 });
    expect(counterOrder([], 300)).toEqual([]);
  });
});
