// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { nextRound, roundFor } from "@/lib/kvk/prep";
import { roundKey } from "@/lib/kvk/prep-schedule";
import { memoryMinistryStore } from "@/lib/ministry/memory-store";
import { NO_AMOUNTS } from "@/lib/ministry/ministry";
import { mapAppointmentRow, mapSignupRow, publishedRoster } from "@/lib/ministry/store";
import { sectionsFor } from "@/lib/ministry/ministry";
import { planMove } from "@/lib/ministry/times";

describe("mapSignupRow", () => {
  it("reads a database row tolerantly", () => {
    const row = mapSignupRow({
      id: "a",
      round: "2026-11-29",
      governor_id: "12345678",
      game_name: "Rudy",
      alliance_tag: "Nam",
      verified: true,
      power: "98000000",
      amounts: { truegold: 5, nonsense: 1 },
      slots: { "1": [3, 3, 2], "7": [1] },
      disabled: null,
      device_hash: "",
      locale: null,
      created_at: "2026-11-20T10:00:00Z",
      updated_at: "2026-11-20T10:00:00Z",
    });
    expect(row).toMatchObject({ governorId: "12345678", allianceTag: "Nam", verified: true, power: 98_000_000, amounts: { ...NO_AMOUNTS, truegold: 5 }, slots: { 1: [2, 3] }, disabled: false, deviceHash: null, locale: "en" });
    // A row from before migration 0030 has no times per buff and was never moved.
    expect(row.times).toBeNull();
    expect(row.movedAt).toBeNull();
  });

  it("reads the times per buff and the moved mark", () => {
    const row = mapSignupRow({ id: "a", slots: { "2": [4] }, times: { construction: [4, 4], other: [1] }, days_moved_at: "2026-11-27T09:00:00Z" });
    expect(row.times).toEqual({ construction: [4] });
    expect(row.movedAt).toBe("2026-11-27T09:00:00Z");
  });
});

describe("mapAppointmentRow", () => {
  it("reads an appointment and drops a row that isn't one", () => {
    expect(mapAppointmentRow({ signup_id: "a", day: 4, slot: 47, source: "late" })).toEqual({ signupId: "a", day: 4, slot: 47, source: "late" });
    expect(mapAppointmentRow({ signup_id: "a", day: 6, slot: 1, source: "auto" })).toBeNull();
    expect(mapAppointmentRow({ signup_id: "a", day: 1, slot: 48, source: "auto" })).toBeNull();
    expect(mapAppointmentRow({ signup_id: "a", day: 1, slot: 1, source: "someone" })).toBeNull();
  });
});

describe("the memory store", () => {
  const round = roundKey(nextRound(roundFor(new Date())));
  const entry = { round, governorId: "70000001", gameName: "Test", allianceTag: null, verified: false, power: null, amounts: { ...NO_AMOUNTS, truegold: 1 }, slots: { 1: [0] }, times: { construction: [0] }, locale: "en", deviceHash: "abc" };

  it("opens the next round with demo players", async () => {
    const store = memoryMinistryStore();
    const settings = (await store.settings())[round];
    expect(settings.open).toBe(true);
    // Only the training day is past its deadline, so its roster shows; the other days take sign-ups.
    expect(Object.keys(settings.deadlines)).toEqual(["4"]);
    expect(Date.parse(settings.deadlines[4] as string)).toBeLessThan(Date.now());
    expect(await store.count(round)).toBeGreaterThan(0);
  });

  it("gives a day's appointments out all or nothing, once at the deadline, and keeps hand placements", async () => {
    const store = memoryMinistryStore();
    const [a, b, c] = await store.list(round);
    await store.clearRoster(round, 2);
    expect((await store.roster(round)).assignedAt[2]).toBeUndefined();
    expect(await store.assign(round, 2, [{ signupId: a.id, slot: 10 }], true)).toBe("done");
    // The deadline's run happens once.
    expect(await store.assign(round, 2, [{ signupId: b.id, slot: 11 }], true)).toBe("skipped");
    expect((await store.roster(round)).appointments.filter((held) => held.day === 2)).toEqual([{ signupId: a.id, day: 2, slot: 10, source: "auto" }]);

    // By hand: a taken slot is refused, a free one is theirs, and a move takes the player along.
    expect(await store.place(round, 2, b.id, 10, "moderator")).toBe("slotTaken");
    expect(await store.place(round, 2, b.id, 20, "moderator")).toBe("ok");
    expect(await store.place(round, 2, b.id, 21, "moderator")).toBe("ok");
    // A new run replaces only the assignment's own places, and fails whole when it would hit a kept one.
    expect(await store.assign(round, 2, [{ signupId: c.id, slot: 21 }], false)).toBe("clash");
    expect(await store.assign(round, 2, [{ signupId: c.id, slot: 5 }], false)).toBe("done");
    expect((await store.roster(round)).appointments.filter((held) => held.day === 2)).toEqual([
      { signupId: c.id, day: 2, slot: 5, source: "auto" },
      { signupId: b.id, day: 2, slot: 21, source: "moderator" },
    ]);

    // ▲ ▼ onto a neighbour: the two trade places, both placed by hand from then on.
    expect(await store.swap(round, 2, b.id, c.id)).toBe(true);
    expect((await store.roster(round)).appointments.filter((held) => held.day === 2)).toEqual([
      { signupId: b.id, day: 2, slot: 5, source: "moderator" },
      { signupId: c.id, day: 2, slot: 21, source: "moderator" },
    ]);
    expect(await store.swap(round, 2, a.id, c.id)).toBe(false);

    await store.unplace(b.id, [2]);
    await store.clearRoster(round, 2);
    const cleared = await store.roster(round);
    expect(cleared.appointments.filter((held) => held.day === 2)).toEqual([]);
    expect(cleared.assignedAt[2]).toBeUndefined();
  });

  it("keeps what players see apart from the moderators' draft until a publish, and a discard goes back to it", async () => {
    const store = memoryMinistryStore();
    const [a, b] = await store.list(round);
    await store.clearRoster(round, 5);
    await store.assign(round, 5, [{ signupId: a.id, slot: 4 }], false);
    // Assigned, never published: players see no list for the day.
    expect((await store.roster(round)).published[5]).toBeUndefined();
    expect(publishedRoster(await store.roster(round)).assignedAt[5]).toBeUndefined();
    await store.publish(round, 5);
    const live = [{ signupId: a.id, day: 5, slot: 4, source: "auto" }];
    expect((await store.roster(round)).published[5]).toEqual(live);

    // A move and a new player: the draft changes, the published copy stays.
    await store.place(round, 5, a.id, 6, "moderator");
    await store.place(round, 5, b.id, 4, "moderator");
    const draft = await store.roster(round);
    expect(draft.appointments.filter((held) => held.day === 5).map((held) => held.slot)).toEqual([4, 6]);
    expect(draft.published[5]).toEqual(live);
    expect(publishedRoster(draft).appointments.filter((held) => held.day === 5)).toEqual(live);

    // Discard: back to what players see. From scratch: the published copy outlives the emptied day.
    expect(await store.restore(round, 5)).toBe(true);
    expect((await store.roster(round)).appointments.filter((held) => held.day === 5)).toEqual(live);
    await store.clearAppointments(round, 5);
    const emptied = await store.roster(round);
    expect(emptied.appointments.filter((held) => held.day === 5)).toEqual([]);
    expect(emptied.published[5]).toEqual(live);
    await store.clearRoster(round, 5);
    expect(await store.restore(round, 5)).toBe(false);
  });

  it("a late player's appointment goes to players and into the draft at once, and neither is disturbed", async () => {
    const store = memoryMinistryStore();
    const [a, b, c, d] = await store.list(round);
    await store.clearRoster(round, 5);
    await store.assign(round, 5, [{ signupId: a.id, slot: 4 }], false);
    // Not published yet: nothing to take.
    expect(await store.takeLate(round, 5, d.id, 10)).toBe("unavailable");
    await store.publish(round, 5);
    // The moderators' draft: a moves to 03:00, b comes in at 05:00. Players still see a at 02:00.
    await store.place(round, 5, a.id, 6, "moderator");
    await store.place(round, 5, b.id, 10, "moderator");

    // Taken for players (02:00) or in the draft (03:00, 05:00): refused. A player with an appointment gets no second one.
    expect(await store.takeLate(round, 5, d.id, 4)).toBe("slotTaken");
    expect(await store.takeLate(round, 5, d.id, 6)).toBe("slotTaken");
    expect(await store.takeLate(round, 5, d.id, 10)).toBe("slotTaken");
    expect(await store.takeLate(round, 5, b.id, 20)).toBe("held");
    expect(await store.takeLate(round, 5, a.id, 20)).toBe("held");

    expect(await store.takeLate(round, 5, d.id, 20)).toBe("ok");
    expect(await store.takeLate(round, 5, c.id, 20)).toBe("slotTaken");
    expect(await store.takeLate(round, 5, d.id, 21)).toBe("held");
    const late = { signupId: d.id, day: 5, slot: 20, source: "late" };
    const after = await store.roster(round);
    // Players see it at once, next to what they saw before; the draft has it too, with its own changes untouched.
    expect(after.published[5]).toEqual([{ signupId: a.id, day: 5, slot: 4, source: "auto" }, late]);
    expect(after.appointments.filter((held) => held.day === 5)).toEqual([
      { signupId: a.id, day: 5, slot: 6, source: "moderator" },
      { signupId: b.id, day: 5, slot: 10, source: "moderator" },
      late,
    ]);

    // Discarding the draft keeps the late player; so does publishing it.
    expect(await store.restore(round, 5)).toBe(true);
    expect((await store.roster(round)).appointments.filter((held) => held.day === 5)).toEqual([{ signupId: a.id, day: 5, slot: 4, source: "auto" }, late]);
    await store.place(round, 5, a.id, 6, "moderator");
    await store.publish(round, 5);
    expect((await store.roster(round)).published[5]).toEqual([{ signupId: a.id, day: 5, slot: 6, source: "moderator" }, late]);
    await store.clearRoster(round, 5);
  });

  it("empties a round: its sign-ups, appointments and marks go, another round stays", async () => {
    const store = memoryMinistryStore();
    const other = "2099-01-04";
    const kept = await store.insert({ ...entry, round: other, governorId: "70000009" });
    if (kept === "duplicate") throw new Error("unexpected duplicate");
    const before = await store.count(round);
    expect(before).toBeGreaterThan(0);
    const first = (await store.list(round))[0];
    await store.assign(round, 2, [{ signupId: first.id, slot: 3 }], false);
    expect(await store.removeRound(round)).toBe(before);
    expect(await store.count(round)).toBe(0);
    const roster = await store.roster(round);
    expect(roster.appointments).toEqual([]);
    expect(roster.assignedAt).toEqual({});
    expect(await store.get(kept.id)).not.toBeNull();
    expect(await store.removeRound(round)).toBe(0);
    await store.remove(kept.id);
  });

  it("moves a round's entries with the buff days: times, the moved mark and the rosters of the days that changed hands", async () => {
    const store = memoryMinistryStore();
    const other = "2099-02-01";
    const insert = async (governorId: string, slots: Record<number, number[]>) => {
      const saved = await store.insert({ ...entry, round: other, governorId, slots, times: {} });
      if (saved === "duplicate") throw new Error("unexpected duplicate");
      return saved;
    };
    const a = await insert("70000021", { 1: [4], 2: [9] });
    const b = await insert("70000022", { 4: [7] });
    await store.assign(other, 1, [{ signupId: a.id, slot: 4 }], false);
    await store.publish(other, 1);
    await store.assign(other, 4, [{ signupId: b.id, slot: 7 }], false);

    const before = sectionsFor({ construction: 1, research: 2 });
    const after = sectionsFor({ construction: 2, research: 1 });
    const rows = await store.list(other);
    const plan = planMove(rows, before, after);
    const moved = plan.entries.map((row, index) => ({ ...row, updatedAt: rows[index].updatedAt }));

    // A sign-up saved since the entries were read: nothing is written.
    expect(await store.moveDays(other, [{ ...moved[0], updatedAt: "2000-01-01T00:00:00.000Z" }, moved[1]], plan.days, null)).toBe("changed");
    expect(await store.moveDays(other, [moved[0]], plan.days, null)).toBe("changed");
    expect((await store.get(a.id))?.slots).toEqual({ 1: [4], 2: [9] });

    expect(await store.moveDays(other, moved, plan.days, null)).toBe("ok");
    const swapped = await store.get(a.id);
    expect(swapped?.slots).toEqual({ 1: [9], 2: [4] });
    expect(swapped?.times).toEqual({ construction: [4], research: [9] });
    expect(swapped?.movedAt).not.toBeNull();
    // The training day didn't change hands: its entry and its roster stay.
    expect((await store.get(b.id))?.movedAt).toBeNull();
    const roster = await store.roster(other);
    expect(roster.appointments).toEqual([{ signupId: b.id, day: 4, slot: 7, source: "auto" }]);
    expect(Object.keys(roster.assignedAt)).toEqual(["4"]);
    expect(roster.published).toEqual({});

    // Saving the times again clears the mark.
    expect((await store.update(a.id, { slots: { 1: [9], 2: [5] }, times: { construction: [5], research: [9] } }))?.movedAt).toBeNull();
    await store.removeRound(other);
  });

  it("keeps one entry per Governor ID and finds a browser's own", async () => {
    const store = memoryMinistryStore();
    const saved = await store.insert(entry);
    expect(saved).not.toBe("duplicate");
    expect(await store.insert(entry)).toBe("duplicate");
    expect((await store.byDevice(round, "abc")).map((row) => row.governorId)).toEqual(["70000001"]);
    const id = (await store.byGovernor(round, "70000001"))?.id as string;
    expect((await store.update(id, { disabled: true }))?.disabled).toBe(true);
    expect(await store.remove(id)).toBe(true);
    expect(await store.get(id)).toBeNull();
    expect(await store.update(id, { disabled: false })).toBeNull();
  });
});
