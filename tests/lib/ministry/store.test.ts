// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { nextRound, roundFor } from "@/lib/kvk/prep";
import { roundKey } from "@/lib/kvk/prep-schedule";
import { memoryMinistryStore } from "@/lib/ministry/memory-store";
import { NO_AMOUNTS } from "@/lib/ministry/ministry";
import { mapAppointmentRow, mapSignupRow } from "@/lib/ministry/store";

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
  const entry = { round, governorId: "70000001", gameName: "Test", allianceTag: null, verified: false, power: null, amounts: { ...NO_AMOUNTS, truegold: 1 }, slots: { 1: [0] }, locale: "en", deviceHash: "abc" };

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
