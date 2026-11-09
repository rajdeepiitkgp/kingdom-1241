// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { prepRound, TEMPLATE_SCHEDULE } from "@/lib/kvk/prep";
import { localSchedules, offeredRounds, parsePrepScheduleForm, parsePrepSchedules, roundKey, sameSchedule, scheduleFor, withRound } from "@/lib/kvk/prep-schedule";

const form = (fields: Record<string, string>) => ({ get: (name: string) => fields[name] ?? null });

describe("the council's buff days", () => {
  it("key a round by its Sunday", () => {
    expect(roundKey(prepRound(0))).toBe("2026-11-01");
    expect(roundKey(prepRound(1))).toBe("2026-11-29");
  });

  it("offer the round in progress (or next up) and the one after it", () => {
    const midWeek = offeredRounds(new Date("2026-11-04T12:00:00Z"));
    expect([roundKey(midWeek.current), roundKey(midWeek.next)]).toEqual(["2026-11-01", "2026-11-29"]);
    const afterShields = offeredRounds(new Date("2026-11-07T23:00:00Z"));
    expect([roundKey(afterShields.current), roundKey(afterShields.next)]).toEqual(["2026-11-29", "2026-12-27"]);
  });

  it("read the stored value tolerantly", () => {
    expect(parsePrepSchedules(null)).toEqual({});
    expect(parsePrepSchedules("x")).toEqual({});
    expect(parsePrepSchedules({ rounds: [] })).toEqual({});
    expect(
      parsePrepSchedules({
        rounds: {
          "2026-11-01": { construction: 5, research: 2 },
          "2026-11-29": { construction: 1, research: 1 },
          "2026-12-27": { construction: 3, research: 2 },
          "2027-01-24": { construction: "5", research: 2 },
          "bad key": { construction: 1, research: 2 },
          "2027-02-21": null,
        },
      }),
    ).toEqual({ "2026-11-01": { construction: 5, research: 2 }, "2026-11-29": { construction: 1, research: 1 } });
  });

  it("take a local review's schedule from the environment for the offered rounds, or nothing", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(localSchedules('{"construction":5,"research":1}', now)).toEqual({
      "2026-11-29": { construction: 5, research: 1 },
      "2026-12-27": { construction: 5, research: 1 },
    });
    for (const raw of [undefined, "", "  ", "not json", '{"construction":3,"research":1}', '{"construction":5}', "[]"]) expect(localSchedules(raw, now), String(raw)).toEqual({});
  });

  it("give a round its own schedule, else the template", () => {
    const rounds = parsePrepSchedules({ rounds: { "2026-11-29": { construction: 5, research: 2 } } });
    expect(scheduleFor(rounds, prepRound(1))).toEqual({ construction: 5, research: 2 });
    expect(scheduleFor(rounds, prepRound(0))).toBe(TEMPLATE_SCHEDULE);
    expect(sameSchedule(TEMPLATE_SCHEDULE, { construction: 1, research: 2 })).toBe(true);
    expect(sameSchedule(TEMPLATE_SCHEDULE, { construction: 1, research: 5 })).toBe(false);
  });

  it("keep the current and later rounds at a save and drop the ones that are over", () => {
    const rounds = { "2026-10-04": { construction: 5, research: 5 }, "2026-11-01": { construction: 1, research: 2 }, "2026-12-27": { construction: 2, research: 2 } } as const;
    expect(withRound(rounds, "2026-11-29", { construction: 5, research: 2 }, "2026-11-01")).toEqual({
      rounds: {
        "2026-11-01": { construction: 1, research: 2 },
        "2026-11-29": { construction: 5, research: 2 },
        "2026-12-27": { construction: 2, research: 2 },
      },
    });
    // The current round can be changed in the middle of the week.
    expect(withRound(rounds, "2026-11-01", { construction: 5, research: 2 }, "2026-11-01").rounds["2026-11-01"]).toEqual({ construction: 5, research: 2 });
  });

  it("take Day 1, 2 or 5 for each ministry from the form, the same day for both included", () => {
    const rounds = ["2026-11-01", "2026-11-29"];
    expect(parsePrepScheduleForm(form({ round: "2026-11-29", construction: "5", research: "2" }), rounds)).toEqual({
      ok: true,
      value: { round: "2026-11-29", schedule: { construction: 5, research: 2 } },
    });
    expect(parsePrepScheduleForm(form({ round: "2026-11-01", construction: "5", research: "5" }), rounds)).toMatchObject({ ok: true });
    expect(parsePrepScheduleForm(form({ round: "2026-11-01", construction: "3", research: "2" }), rounds)).toEqual({ ok: false, errors: { construction: "Day 1, 2 or 5." } });
    expect(parsePrepScheduleForm(form({ round: "2026-11-01", construction: "1" }), rounds)).toEqual({ ok: false, errors: { research: "Day 1, 2 or 5." } });
    expect(parsePrepScheduleForm(form({ round: "2026-12-27", construction: "1", research: "2" }), rounds)).toEqual({ ok: false, errors: { round: "Pick one of the rounds shown." } });
  });
});
