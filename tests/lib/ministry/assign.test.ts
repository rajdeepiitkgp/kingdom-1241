// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { type Appointment, assignDay, assignSlots, type Candidate, draftChanges, firstFreeOwn, freeSlots, holdsAppointment, isFixed, lateCandidates, lateNotice, lateSlots, placementProblem, rosterChat, rosterOf } from "@/lib/ministry/assign";
import { NO_AMOUNTS, rankSection, type Section, type Signup, SLOTS_PER_DAY } from "@/lib/ministry/ministry";

const c = (id: string, ...slots: number[]): Candidate => ({ id, slots });

/** Every way of placing the candidates, to compare the assignment against: the most slots a day can fill. */
function mostFilled(candidates: readonly Candidate[], used = new Set<number>(), from = 0): number {
  if (from === candidates.length) return 0;
  let best = mostFilled(candidates, used, from + 1);
  for (const slot of candidates[from].slots) {
    if (used.has(slot)) continue;
    used.add(slot);
    best = Math.max(best, 1 + mostFilled(candidates, used, from + 1));
    used.delete(slot);
  }
  return best;
}

describe("assignSlots", () => {
  it("gives each player a slot they picked, one each, no slot twice", () => {
    const ranked = [c("a", 0, 1), c("b", 0, 1), c("c", 1, 2)];
    const given = assignSlots(ranked);
    expect(given.size).toBe(3);
    expect(new Set(given.values()).size).toBe(3);
    for (const candidate of ranked) expect(candidate.slots).toContain(given.get(candidate.id));
  });

  it("moves a higher player to another of their times when that makes room for a lower one", () => {
    // a could take 0 or 1, b only 0: a greedy pass would give a slot 0 and leave b out.
    const given = assignSlots([c("a", 0, 1), c("b", 0)]);
    expect(given.get("a")).toBe(1);
    expect(given.get("b")).toBe(0);
  });

  it("when two players can't both be placed, the one higher on the list gets the place", () => {
    const given = assignSlots([c("high", 5), c("low", 5)]);
    expect(given.get("high")).toBe(5);
    expect(given.has("low")).toBe(false);
  });

  it("never drops a placed player for a lower one, only moves them", () => {
    const given = assignSlots([c("a", 0), c("b", 0, 1), c("c", 1), c("d", 0, 1)]);
    expect(given.get("a")).toBe(0);
    expect(given.get("b")).toBe(1);
    expect(given.has("c")).toBe(false);
    expect(given.has("d")).toBe(false);
  });

  it("fills as many slots as any placing could, on many small days", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 200; round++) {
      const candidates = Array.from({ length: 1 + Math.floor(random() * 6) }, (_, index) => {
        const slots = [0, 1, 2, 3, 4].filter(() => random() < 0.4);
        return c(`p${index}`, ...slots);
      });
      const given = assignSlots(candidates);
      expect(given.size).toBe(mostFilled(candidates));
      expect(new Set(given.values()).size).toBe(given.size);
      for (const candidate of candidates) if (given.has(candidate.id)) expect(candidate.slots).toContain(given.get(candidate.id));
    }
  });

  it("the placed set is the best for the top of the list: nobody is out while a lower player is in at their cost", () => {
    // Dropping any placed lower player never lets an unplaced higher one in (else the list order was not honoured).
    const candidates = [c("a", 0, 1), c("b", 0), c("c", 0, 1), c("d", 1), c("e", 2)];
    const given = assignSlots(candidates);
    expect([...given.keys()].sort()).toEqual(["a", "b", "e"]);
  });

  it("leaves taken slots alone and skips players who have their place", () => {
    const given = assignSlots([c("a", 0, 1), c("b", 0, 1), c("c", 1)], new Set([0]), new Set(["a"]));
    expect(given.has("a")).toBe(false);
    expect(given.get("b")).toBe(1);
    expect(given.has("c")).toBe(false);
  });

  it("ignores slots outside the day and a player listed twice", () => {
    const given = assignSlots([c("a", -1, 48, 47), c("a", 3)]);
    expect([...given]).toEqual([["a", 47]]);
  });

  it("fills all 48 appointments when every one has a taker", () => {
    const ranked = Array.from({ length: 60 }, (_, index) => c(`p${index}`, index % SLOTS_PER_DAY, (index * 7) % SLOTS_PER_DAY));
    expect(assignSlots(ranked).size).toBe(SLOTS_PER_DAY);
  });
});

const CONSTRUCTION: Section = { day: 1, buffs: ["construction"] };

function signup(id: string, truegold: number, slots: number[], extra: Partial<Signup> = {}): Signup {
  return {
    id,
    round: "2026-11-29",
    governorId: id,
    gameName: id.toUpperCase(),
    allianceTag: "NAM",
    verified: false,
    power: null,
    amounts: { ...NO_AMOUNTS, truegold },
    slots: { 1: slots },
    disabled: false,
    locale: "en",
    createdAt: `2026-11-20T10:00:0${id.length}Z`,
    updatedAt: "2026-11-20T10:00:00Z",
    ...extra,
  };
}

describe("assignDay", () => {
  it("places the day's list by score and names who is left without a place", () => {
    const signups = [signup("low", 10, [4]), signup("high", 500, [4]), signup("mid", 100, [4, 5])];
    const result = assignDay(1, rankSection(signups, CONSTRUCTION));
    expect(result.appointments).toEqual([
      { signupId: "high", day: 1, slot: 4, source: "auto" },
      { signupId: "mid", day: 1, slot: 5, source: "auto" },
    ]);
    expect(result.unplaced).toEqual(["low"]);
  });

  it("keeps players a moderator placed and late players where they are, and plans around them", () => {
    const signups = [signup("top", 900, [4, 5]), signup("hand", 5, [9]), signup("late", 1, [5])];
    const current: Appointment[] = [
      { signupId: "hand", day: 1, slot: 4, source: "moderator" }, // outside the player's own times: a moderator may
      { signupId: "late", day: 1, slot: 5, source: "late" },
      { signupId: "top", day: 1, slot: 4, source: "auto" }, // an old run: thrown away
    ];
    const result = assignDay(1, rankSection(signups, CONSTRUCTION), current);
    expect(result.appointments).toEqual([
      { signupId: "hand", day: 1, slot: 4, source: "moderator" },
      { signupId: "late", day: 1, slot: 5, source: "late" },
    ]);
    expect(result.unplaced).toEqual(["top"]);
  });

  it("drops the fixed place of a player who was set aside or left the day", () => {
    const signups = [signup("gone", 50, [4], { disabled: true }), signup("stays", 10, [4])];
    const current: Appointment[] = [{ signupId: "gone", day: 1, slot: 4, source: "moderator" }];
    const result = assignDay(1, rankSection(signups, CONSTRUCTION), current);
    expect(result.appointments).toEqual([{ signupId: "stays", day: 1, slot: 4, source: "auto" }]);
  });

  it("looks only at its own day's appointments", () => {
    const signups = [signup("a", 50, [4])];
    const current: Appointment[] = [{ signupId: "a", day: 4, slot: 4, source: "moderator" }];
    expect(assignDay(1, rankSection(signups, CONSTRUCTION), current).appointments).toEqual([{ signupId: "a", day: 1, slot: 4, source: "auto" }]);
  });

  it("only the assignment's own places are replaced by a new run", () => {
    expect(isFixed({ source: "auto" })).toBe(false);
    expect(isFixed({ source: "moderator" })).toBe(true);
    expect(isFixed({ source: "late" })).toBe(true);
  });
});

describe("the roster", () => {
  const appointments: Appointment[] = [
    { signupId: "a", day: 1, slot: 0, source: "auto" },
    { signupId: "b", day: 1, slot: 47, source: "late" },
    { signupId: "c", day: 4, slot: 3, source: "auto" },
  ];

  it("has the day's 48 appointments in order, free ones as null", () => {
    const roster = rosterOf(appointments, 1);
    expect(roster).toHaveLength(SLOTS_PER_DAY);
    expect(roster[0]?.signupId).toBe("a");
    expect(roster[47]?.signupId).toBe("b");
    expect(roster.filter(Boolean)).toHaveLength(2);
  });

  it("lists the free slots, and only the ones still ahead when asked", () => {
    expect(freeSlots(appointments, 1)).toHaveLength(46);
    const dayStart = Date.UTC(2026, 10, 30);
    // 12:10 UTC: slot 24 (12:00) has started, slot 25 (12:30) is the first one ahead.
    const ahead = freeSlots(appointments, 1, { dayStart, now: dayStart + (12 * 60 + 10) * 60_000 });
    expect(ahead[0]).toBe(25);
    expect(ahead).toHaveLength(22);
  });

  it("a place can be given when the slot is in the day and free, or already the player's own", () => {
    expect(placementProblem(appointments, 1, "x", 5)).toBeNull();
    expect(placementProblem(appointments, 1, "x", 0)).toBe("slotTaken");
    expect(placementProblem(appointments, 1, "a", 0)).toBeNull();
    expect(placementProblem(appointments, 1, "x", 48)).toBe("badSlot");
    expect(placementProblem(appointments, 1, "x", 1.5)).toBe("badSlot");
    expect(placementProblem(appointments, 4, "x", 0)).toBeNull();
  });

  it("copies for the game chat: a heading and one line per appointment", () => {
    const roster = [{ name: "[NAM] Rudy" }, null, { name: "Sylphy" }];
    expect(rosterChat(roster, "Construction, Mon 30 Nov (UTC)")).toBe("Construction, Mon 30 Nov (UTC)\n00:00–00:30 [NAM] Rudy\n01:00–01:30 Sylphy");
    expect(rosterChat(roster, "Free", true)).toBe("Free\n00:00–00:30 [NAM] Rudy\n00:30–01:00 —\n01:00–01:30 Sylphy");
  });
});

describe("firstFreeOwn", () => {
  it("gives the earliest free time among the player's own, or null", () => {
    const held = [
      { day: 2 as const, slot: 8 },
      { day: 2 as const, slot: 9 },
      { day: 1 as const, slot: 10 },
    ];
    expect(firstFreeOwn(held, 2, [24, 9, 10, 8])).toBe(10);
    expect(firstFreeOwn(held, 2, [8, 9])).toBeNull();
    expect(firstFreeOwn(held, 2, [])).toBeNull();
    expect(firstFreeOwn(held, 1, [8])).toBe(8);
  });
});

describe("late sign-ups", () => {
  const dayStart = Date.UTC(2026, 10, 30);
  const early = { dayStart, now: dayStart - 60_000 };
  // What players see: a at 00:00, b at 00:30. The moderators' draft moved b to 01:00 and added c at 02:00.
  const published: Appointment[] = [
    { signupId: "a", day: 1, slot: 0, source: "auto" },
    { signupId: "b", day: 1, slot: 1, source: "auto" },
  ];
  const working: Appointment[] = [
    { signupId: "a", day: 1, slot: 0, source: "auto" },
    { signupId: "b", day: 1, slot: 2, source: "moderator" },
    { signupId: "c", day: 1, slot: 4, source: "moderator" },
    { signupId: "d", day: 4, slot: 9, source: "auto" },
  ];

  it("offers only half-hours that are free for players and in the moderators' draft", () => {
    const free = lateSlots(working, published, 1, early);
    // 00:30 is free in the draft but players see b there; 01:00 and 02:00 are the draft's; another day's place doesn't count.
    expect(free.slice(0, 4)).toEqual([3, 5, 6, 7]);
    expect(free).toHaveLength(48 - 4);
    expect(free).toContain(9);
  });

  it("offers nothing that has started", () => {
    // 12:10 UTC: 12:00 has started, 12:30 is the first one left.
    expect(lateSlots(working, published, 1, { dayStart, now: dayStart + (12 * 60 + 10) * 60_000 })[0]).toBe(25);
    expect(lateSlots(working, published, 1, { dayStart, now: dayStart + 24 * 3_600_000 })).toEqual([]);
  });

  it("without a draft, every half-hour players see as free is offered", () => {
    expect(lateSlots(published, published, 1, early)).toHaveLength(46);
  });

  it("tries the free half-hours inside the times picked, earliest first", () => {
    // A two-hour block 00:00–02:00 (slots 0–3) with one half-hour left, and a later block.
    expect(lateCandidates([3, 5, 6, 7, 8], [8, 9, 10, 11, 0, 1, 2, 3])).toEqual([3, 8]);
    expect(lateCandidates([3, 5], [0, 1, 2])).toEqual([]);
    // One button per half-hour: the pick is the appointment.
    expect(lateCandidates([3, 5, 6], [5])).toEqual([5]);
  });

  it("tells the council's Discord who took which half-hour, so a moderator appoints them in the game", () => {
    expect(lateNotice({ gameName: "Rudy", allianceTag: "NAM" }, "Training", 4, "Thu 31 Dec", 29)).toBe(
      "👑 Ministry: **[NAM] Rudy** took a free appointment after the deadline. Training, Day 4 (Thu 31 Dec), 14:30–15:00 UTC. It is on the roster already; appoint them in the game at that time.",
    );
    expect(lateNotice({ gameName: "Sylphy", allianceTag: null }, "Construction + Research", 1, "Mon 28 Dec", 0)).toContain("**Sylphy** took a free appointment after the deadline. Construction + Research, Day 1 (Mon 28 Dec), 00:00–00:30 UTC.");
  });

  it("a player with an appointment that day, in the draft or for players, takes no free one", () => {
    expect(holdsAppointment(working, published, 1, "a")).toBe(true);
    expect(holdsAppointment(working, published, 1, "c")).toBe(true); // in the draft only
    expect(holdsAppointment([], published, 1, "b")).toBe(true); // for players only
    expect(holdsAppointment(working, published, 1, "d")).toBe(false); // another day
    expect(holdsAppointment(working, published, 1, "z")).toBe(false);
  });
});

describe("draftChanges", () => {
  it("lists the half-hours where the working roster differs from the published one", () => {
    const live = [
      { day: 2 as const, slot: 8, signupId: "a" },
      { day: 2 as const, slot: 9, signupId: "b" },
      { day: 1 as const, slot: 3, signupId: "a" },
    ];
    expect(draftChanges(live, live, 2)).toEqual([]);
    // b moved to 10, c took 9, a left: three half-hours read differently.
    const draft = [
      { day: 2 as const, slot: 9, signupId: "c" },
      { day: 2 as const, slot: 10, signupId: "b" },
      { day: 1 as const, slot: 3, signupId: "a" },
    ];
    expect(draftChanges(draft, live, 2)).toEqual([8, 9, 10]);
    expect(draftChanges(draft, live, 1)).toEqual([]);
    expect(draftChanges(draft, [], 2)).toEqual([9, 10]);
  });
});

