// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { dayStart, prepRound } from "@/lib/kvk/prep";
import {
  type Amounts,
  buffScore,
  cleanSlots,
  deadlineFor,
  latestDueRound,
  defaultDeadline,
  NO_AMOUNTS,
  parseAmounts,
  parseMinistrySettings,
  parseRoundSettingsForm,
  parseSlotChoice,
  PICK_MINUTES,
  pickBlocks,
  rankSection,
  roundDue,
  roundOver,
  sectionScore,
  sectionsFor,
  sectionState,
  type Signup,
  slotDemand,
  slotLabel,
  slotRuns,
  SLOTS_PER_DAY,
  slotStart,
  speedupLabel,
  speedupMinutes,
  splitSpeedup,
  withRoundSettings,
} from "@/lib/ministry/ministry";
import { DAY, HOUR } from "@/lib/time";

const ROUND = prepRound(1); // Sunday 29 Nov 2026
const amounts = (given: Partial<Amounts>): Amounts => ({ ...NO_AMOUNTS, ...given });

function signup(id: string, given: Partial<Signup>): Signup {
  return {
    id,
    round: "2026-11-29",
    governorId: id,
    gameName: id,
    allianceTag: null,
    verified: false,
    power: null,
    amounts: NO_AMOUNTS,
    slots: {},
    disabled: false,
    locale: "en",
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
    ...given,
  };
}

describe("slots", () => {
  it("a buff day has 48 half-hour appointments, 00:00 to 24:00 UTC", () => {
    expect(SLOTS_PER_DAY).toBe(48);
    expect(slotLabel(0)).toBe("00:00–00:30");
    expect(slotLabel(47)).toBe("23:30–24:00");
    expect(slotLabel(10, 4)).toBe("05:00–07:00");
    expect(slotStart(ROUND, 5, 47).toISOString()).toBe("2026-12-04T23:30:00.000Z"); // Day 5 is Friday, the whole day
  });

  it("the picker's buttons cover the day once, whatever their length", () => {
    for (const minutes of [30, 60, 120]) {
      const blocks = pickBlocks(minutes);
      expect(blocks).toHaveLength((24 * 60) / minutes);
      expect(blocks.flat()).toEqual(Array.from({ length: 48 }, (_, i) => i));
    }
    expect(pickBlocks()).toHaveLength((24 * 60) / PICK_MINUTES);
  });

  it("cleans a slot list and reads it as runs", () => {
    expect(cleanSlots([5, 4, 4, 48, -1, 1.5, "3", 7])).toEqual([4, 5, 7]);
    expect(slotRuns([20, 4, 5, 6, 7])).toEqual([
      [4, 4],
      [20, 1],
    ]);
    expect(parseSlotChoice({ "1": [3, 2, 99], "3": [], "4": "x", "9": [1] })).toEqual({ 1: [2, 3] });
  });
});

describe("sections", () => {
  it("follow the council's buff days; training is always Day 4", () => {
    expect(sectionsFor({ construction: 1, research: 2 })).toEqual([
      { day: 1, buffs: ["construction"] },
      { day: 2, buffs: ["research"] },
      { day: 4, buffs: ["training"] },
    ]);
    expect(sectionsFor({ construction: 5, research: 1 }).map((section) => section.day)).toEqual([1, 4, 5]);
  });

  it("construction and research on one day are one section", () => {
    expect(sectionsFor({ construction: 2, research: 2 })).toEqual([
      { day: 2, buffs: ["construction", "research"] },
      { day: 4, buffs: ["training"] },
    ]);
  });
});

describe("scores", () => {
  it("use the prep page's points", () => {
    expect(buffScore("construction", amounts({ truegold: 10, temperedTruegold: 2, constructionMinutes: 60 }))).toBe(10 * 2000 + 2 * 30000 + 60 * 30);
    expect(buffScore("research", amounts({ tgDust: 500, researchMinutes: 1440 }))).toBe(500 * 1000 + 1440 * 30);
    expect(buffScore("training", amounts({ trainingMinutes: 1440 }))).toBe(43_200);
    // What belongs to another buff doesn't count.
    expect(buffScore("research", amounts({ truegold: 999, trainingMinutes: 999 }))).toBe(0);
  });

  it("a shared day counts both buffs together", () => {
    const both = { day: 2 as const, buffs: ["construction" as const, "research" as const] };
    const given = amounts({ truegold: 1, tgDust: 1, constructionMinutes: 1, researchMinutes: 1 });
    expect(sectionScore(both, given)).toBe(2000 + 1000 + 30 + 30);
  });

  it("speedups are typed as days and hours", () => {
    expect(speedupMinutes(2, 5)).toBe(2 * 1440 + 300);
    expect(splitSpeedup(2 * 1440 + 300)).toEqual({ days: 2, hours: 5 });
    expect(speedupLabel(2 * 1440 + 300)).toBe("2 d 5 h");
    expect(speedupLabel(1440)).toBe("1 d");
    expect(speedupLabel(0)).toBe("0 h");
  });

  it("stored amounts are read tolerantly", () => {
    expect(parseAmounts({ truegold: 12, tgDust: -4, temperedTruegold: "7", constructionMinutes: 1.5 })).toEqual(amounts({ truegold: 12 }));
    expect(parseAmounts(null)).toEqual(NO_AMOUNTS);
    expect(parseAmounts({ truegold: 1e12 }).truegold).toBe(5_000_000);
  });
});

describe("ranking", () => {
  const section = { day: 1 as const, buffs: ["construction" as const] };
  const players = [
    signup("low", { amounts: amounts({ truegold: 10 }), slots: { 1: [0, 1] } }),
    signup("high", { amounts: amounts({ truegold: 500 }), slots: { 1: [1] } }),
    signup("later", { amounts: amounts({ truegold: 10 }), slots: { 1: [2] }, createdAt: "2026-11-21T10:00:00.000Z" }),
    signup("aside", { amounts: amounts({ truegold: 9000 }), slots: { 1: [3] }, disabled: true }),
    signup("other-day", { amounts: amounts({ truegold: 9000 }), slots: { 4: [3] } }),
  ];

  it("highest score first, then whoever signed up first; set-aside entries and other days left out", () => {
    expect(rankSection(players, section).map((row) => row.signup.id)).toEqual(["high", "low", "later"]);
  });

  it("counts who can take each appointment", () => {
    const demand = slotDemand(rankSection(players, section), 1);
    expect(demand.slice(0, 4)).toEqual([1, 2, 1, 0]);
    expect(demand).toHaveLength(48);
  });
});

describe("round settings", () => {
  it("a day's deadline is a day before it starts unless the council set one", () => {
    expect(defaultDeadline(ROUND, 1).toISOString()).toBe("2026-11-29T00:00:00.000Z");
    expect(deadlineFor({ open: true, deadlines: {} }, ROUND, 4).toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(deadlineFor({ open: true, deadlines: { 4: "2026-12-01T18:00:00.000Z" } }, ROUND, 4).toISOString()).toBe("2026-12-01T18:00:00.000Z");
  });

  it("sign-ups for a day are open until its deadline", () => {
    const deadline = new Date("2026-11-29T00:00:00Z");
    expect(sectionState(new Date(deadline.getTime() - 1), deadline)).toBe("open");
    expect(sectionState(deadline, deadline)).toBe("closed");
  });

  it("a round is over when its last buff day has ended", () => {
    const sections = sectionsFor({ construction: 1, research: 2 }); // last: Day 4
    expect(roundOver(new Date(dayStart(ROUND, 4).getTime() + DAY - 1), ROUND, sections)).toBe(false);
    expect(roundOver(new Date(dayStart(ROUND, 4).getTime() + DAY), ROUND, sections)).toBe(true);
  });

  it("the stored value is read tolerantly", () => {
    expect(parseMinistrySettings(null)).toEqual({});
    expect(parseMinistrySettings({ rounds: { "2026-11-29": { open: true, deadlines: { "1": "2026-11-28T12:00:00Z", "3": "nonsense", "4": 5 } }, bad: { open: true }, "2026-12-27": {} } })).toEqual({
      "2026-11-29": { open: true, deadlines: { 1: "2026-11-28T12:00:00.000Z" } },
      "2026-12-27": { open: false, deadlines: {} },
    });
  });

  it("a save keeps the rounds from the current one on", () => {
    const stored = { "2026-11-01": { open: true, deadlines: {} }, "2026-11-29": { open: false, deadlines: {} } };
    expect(Object.keys(withRoundSettings(stored, "2026-12-27", { open: true, deadlines: {} }, "2026-11-29").rounds)).toEqual(["2026-11-29", "2026-12-27"]);
  });

  it("a round's sign-ups are kept two weeks after its week", () => {
    expect(roundDue(ROUND.start, new Date(ROUND.start.getTime() + 21 * DAY - 1))).toBe(false);
    expect(roundDue(ROUND.start, new Date(ROUND.start.getTime() + 21 * DAY))).toBe(true);
    // The prune deletes every round up to the newest one that is due.
    expect(latestDueRound(new Date("2026-11-20T00:00:00Z"))).toBeNull();
    expect(latestDueRound(new Date("2026-11-22T00:00:00Z"))).toBe("2026-11-01");
    expect(latestDueRound(new Date(ROUND.start.getTime() + 21 * DAY - 1))).toBe("2026-11-01");
    expect(latestDueRound(new Date(ROUND.start.getTime() + 21 * DAY))).toBe("2026-11-29");
  });

  describe("the admin form", () => {
    const rounds = [{ key: "2026-11-29", round: ROUND, sections: sectionsFor({ construction: 1, research: 2 }) }];
    const form = (fields: Record<string, string>) => ({ get: (name: string) => fields[name] ?? null });

    it("takes the switch and a deadline per buff day; the default is not stored", () => {
      const result = parseRoundSettingsForm(form({ round: "2026-11-29", open: "on", "deadline.1": "2026-11-29T00:00", "deadline.2": "2026-11-29T18:30", "deadline.4": "" }), rounds);
      expect(result).toEqual({ ok: true, value: { round: "2026-11-29", settings: { open: true, deadlines: { 2: "2026-11-29T18:30:00.000Z" } } } });
    });

    it("refuses a deadline after the day has started, and a round that isn't offered", () => {
      const late = parseRoundSettingsForm(form({ round: "2026-11-29", "deadline.1": "2026-11-30T00:01" }), rounds);
      expect(late.ok).toBe(false);
      expect(!late.ok && Object.keys(late.errors)).toEqual(["deadline.1"]);
      // 00:00 of the day itself is the latest.
      expect(parseRoundSettingsForm(form({ round: "2026-11-29", "deadline.1": "2026-11-30T00:00" }), rounds).ok).toBe(true);
      expect(parseRoundSettingsForm(form({ round: "2027-01-01" }), rounds).ok).toBe(false);
      expect(parseRoundSettingsForm(form({ round: "2026-11-29", "deadline.2": "tomorrow" }), rounds).ok).toBe(false);
    });

    it("an unticked switch closes the round", () => {
      const result = parseRoundSettingsForm(form({ round: "2026-11-29" }), rounds);
      expect(result.ok && result.value.settings.open).toBe(false);
    });
  });

  it("the default deadline leaves the council a day", () => {
    expect(dayStart(ROUND, 2).getTime() - defaultDeadline(ROUND, 2).getTime()).toBe(24 * HOUR);
  });
});
