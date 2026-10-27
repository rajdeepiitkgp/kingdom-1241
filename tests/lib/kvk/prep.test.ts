// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import {
  dayCountdown,
  dayEnd,
  dayPlan,
  dayStart,
  defaultDay,
  INTEL_STACK_STEPS,
  intelStackFor,
  markOn,
  pointsOn,
  PREP_DAYS,
  PREP_ITEMS,
  PREP_POINTS,
  PREP_TIPS,
  prepPhase,
  prepRound,
  roundFor,
  SCORING_DAYS,
} from "@/lib/kvk/prep";

const at = (iso: string) => new Date(iso);
const ids = (items: ReadonlyArray<{ id: string }>) => items.map((i) => i.id);

describe("prep rounds", () => {
  it("start on Sunday 1 Nov 2026 and repeat every four weeks", () => {
    expect(prepRound(0).start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(prepRound(1).start.toISOString()).toBe("2026-11-29T00:00:00.000Z");
    expect(prepRound(-1).start.toISOString()).toBe("2026-10-04T00:00:00.000Z");
    for (const index of [0, 1, 13]) expect(prepRound(index).start.getUTCDay()).toBe(0);
  });

  it("end Day 5 at the invasion on Saturday 10:00 UTC and keep shields up until 22:00 UTC", () => {
    const round = prepRound(0);
    expect(round.invasionAt.toISOString()).toBe("2026-11-07T10:00:00.000Z");
    expect(round.battleAt.toISOString()).toBe("2026-11-07T12:00:00.000Z");
    expect(round.battleEndAt.toISOString()).toBe("2026-11-07T17:00:00.000Z");
    expect(round.shieldEndAt.toISOString()).toBe("2026-11-07T22:00:00.000Z");
    expect(dayStart(round, 5).toISOString()).toBe("2026-11-06T00:00:00.000Z");
    expect(dayEnd(round, 5)).toEqual(round.invasionAt);
  });

  it("run Days 0–4 from midnight to midnight UTC", () => {
    const round = prepRound(0);
    expect(dayStart(round, 1).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(dayEnd(round, 4).toISOString()).toBe("2026-11-06T00:00:00.000Z");
    for (const day of [0, 1, 2, 3] as const) expect(dayEnd(round, day)).toEqual(dayStart(round, (day + 1) as 1 | 2 | 3 | 4));
  });

  it("switch to the next round once the shield window is over", () => {
    expect(roundFor(at("2026-10-27T09:00:00Z"))).toEqual(prepRound(0));
    expect(roundFor(at("2026-11-07T21:59:59Z"))).toEqual(prepRound(0));
    expect(roundFor(at("2026-11-07T22:00:00Z"))).toEqual(prepRound(1));
    expect(roundFor(at("2026-11-29T00:00:00Z"))).toEqual(prepRound(1));
  });
});

describe("prepPhase", () => {
  it("counts down to Day 1 (Monday) between rounds; the get-ready Sunday is part of the wait", () => {
    expect(prepPhase(at("2026-10-27T09:00:00Z"))).toEqual({ kind: "before", until: at("2026-11-02T00:00:00Z") });
    expect(prepPhase(at("2026-11-07T22:00:00Z"))).toEqual({ kind: "before", until: at("2026-11-30T00:00:00Z") });
  });

  it("names the day and when it ends", () => {
    expect(prepPhase(at("2026-11-01T16:00:00Z"))).toEqual({ kind: "day", day: 0, until: at("2026-11-02T00:00:00Z") });
    expect(prepPhase(at("2026-11-02T00:00:00Z"))).toEqual({ kind: "day", day: 1, until: at("2026-11-03T00:00:00Z") });
    expect(prepPhase(at("2026-11-07T09:59:59Z"))).toEqual({ kind: "day", day: 5, until: at("2026-11-07T10:00:00Z") });
  });

  it("covers the invasion, the battle and the shield window after it", () => {
    expect(prepPhase(at("2026-11-07T10:00:00Z"))).toEqual({ kind: "invasion", until: at("2026-11-07T12:00:00Z") });
    expect(prepPhase(at("2026-11-07T12:00:00Z"))).toEqual({ kind: "battle", until: at("2026-11-07T17:00:00Z") });
    expect(prepPhase(at("2026-11-07T17:00:00Z"))).toEqual({ kind: "afterBattle", until: at("2026-11-07T22:00:00Z") });
  });

  it("gives every day its own countdown: to its start, then to its end", () => {
    const round = prepRound(0);
    expect(dayCountdown(round, 3, at("2026-11-02T10:00:00Z"))).toEqual({ state: "upcoming", at: at("2026-11-04T00:00:00Z") });
    expect(dayCountdown(round, 3, at("2026-11-04T10:00:00Z"))).toEqual({ state: "live", at: at("2026-11-05T00:00:00Z") });
    expect(dayCountdown(round, 3, at("2026-11-05T00:00:00Z"))).toEqual({ state: "done", at: at("2026-11-05T00:00:00Z") });
    expect(dayCountdown(round, 5, at("2026-11-07T09:00:00Z"))).toEqual({ state: "live", at: at("2026-11-07T10:00:00Z") });
  });

  it("opens the page on today, Day 0 between rounds and Day 5 on battle day", () => {
    expect(defaultDay(prepPhase(at("2026-11-04T08:00:00Z")))).toBe(3);
    expect(defaultDay(prepPhase(at("2026-10-27T09:00:00Z")))).toBe(0);
    expect(defaultDay(prepPhase(at("2026-11-07T13:00:00Z")))).toBe(5);
    expect(defaultDay(prepPhase(at("2026-11-07T18:00:00Z")))).toBe(5);
  });
});

describe("the prep table", () => {
  it("has unique items with a best day each", () => {
    expect(new Set(ids(PREP_ITEMS)).size).toBe(PREP_ITEMS.length);
    for (const item of PREP_ITEMS) expect(item.marks, item.id).toContain("best");
  });

  it("puts every item of a scoring day in exactly one group", () => {
    for (const day of SCORING_DAYS) {
      const plan = dayPlan(day);
      const all = [...ids(plan.best), ...plan.ok.map((e) => e.item.id), ...plan.wait.map((e) => e.item.id), ...plan.no.map((e) => e.item.id)];
      expect(all.sort()).toEqual(ids(PREP_ITEMS).sort());
    }
    expect(dayPlan(0)).toEqual({ best: [], ok: [], wait: [], no: [] });
  });

  it("matches the council's Day 1 template", () => {
    const plan = dayPlan(1);
    expect(ids(plan.best)).toEqual(["intel", "truegold", "temperedTruegold", "construction", "charms"]);
    expect(plan.ok.map((e) => [e.item.id, e.bestDay])).toEqual([
      ["tgDust", 2],
      ["research", 2],
      ["masterSkill", 2],
    ]);
    expect(plan.wait.map((e) => [e.item.id, e.day])).toEqual([["gathering", 2]]);
    expect(plan.no.find((e) => e.item.id === "troops")?.day).toBe(4);
    expect(plan.no.find((e) => e.item.id === "mithril")?.day).toBe(5);
  });

  it("points 🆗 items at a better later day only", () => {
    expect(dayPlan(4).ok.map((e) => [e.item.id, e.bestDay])).toEqual([
      ["widgets", 5],
      ["hammers", 5],
      ["mithril", 5],
    ]);
    expect(dayPlan(2).ok.map((e) => [e.item.id, e.bestDay])).toEqual([
      ["truegold", null],
      ["temperedTruegold", null],
      ["construction", null],
    ]);
  });

  it("keeps items that no longer count on Day 5 for the next round", () => {
    const plan = dayPlan(5);
    expect(ids(plan.best)).toEqual(["intel", "gathering", "masterSkill", "pets", "gear", "widgets", "hammers", "mithril"]);
    expect(plan.no.map((e) => [e.item.id, e.day])).toEqual([
      ["emblem", null],
      ["manuscript", null],
      ["roulette", null],
      ["shards", null],
      ["charms", null],
    ]);
  });

  it("counts trained troops per troop on Day 4 only; on Day 5 only their speedups score", () => {
    expect(pointsOn("troops", 4)).toEqual({ kind: "perTroop", min: 3, max: 75 });
    expect(pointsOn("troops", 5)).toEqual({ kind: "perMinute", n: 30 });
    expect(pointsOn("mithril", 4)).toEqual(pointsOn("mithril", 5));
  });

  it("has points for every item that is ✅ or 🆗 on some day (the sheet plus kingshotdata.com)", () => {
    for (const item of PREP_ITEMS) {
      const scores = SCORING_DAYS.some((d) => ["best", "ok"].includes(markOn(item, d)));
      expect(Boolean(PREP_POINTS[item.id]) || !scores, item.id).toBe(true);
    }
  });

  it("stacks intel missions the day before each intel day and cashes them in on it", () => {
    expect(PREP_DAYS.map((day) => intelStackFor(day))).toEqual([1, null, 3, null, 5, null]);
    const openDays = PREP_DAYS.filter((day) => PREP_TIPS[day].some((t) => t.id === "intelOpen"));
    expect(openDays).toEqual([1, 3, 5]);
  });

  it("leaves only the 16:00 UTC batch uncompleted and claims everything at the reset", () => {
    expect(INTEL_STACK_STEPS.map((s) => s.hour)).toEqual([0, 8, 16, 24]);
    expect(INTEL_STACK_STEPS.filter((s) => !s.complete).map((s) => s.hour)).toEqual([16]);
    expect(INTEL_STACK_STEPS.filter((s) => !s.claim).map((s) => s.hour)).toEqual([8, 16]);
  });

  it("prepares gathering the day before each gathering day", () => {
    for (const day of PREP_DAYS) {
      const bison = PREP_TIPS[day].find((t) => t.id === "bisonSave");
      if (!bison?.day) continue;
      expect(bison.day).toBe(day + 1);
      expect(PREP_ITEMS.find((i) => i.id === "gathering")?.marks[bison.day - 1]).toBe("best");
      for (const id of ["allianceNode", "gatherEarly", "gatherBoost"] as const) expect(PREP_TIPS[day].some((t) => t.id === id), `${id} on day ${day}`).toBe(true);
    }
  });
});
