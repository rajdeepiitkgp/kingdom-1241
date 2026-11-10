// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { nextRound, roundFor } from "@/lib/kvk/prep";
import { roundKey } from "@/lib/kvk/prep-schedule";
import { memoryMinistryStore } from "@/lib/ministry/memory-store";
import { NO_AMOUNTS } from "@/lib/ministry/ministry";
import { mapSignupRow } from "@/lib/ministry/store";

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

describe("the memory store", () => {
  const round = roundKey(nextRound(roundFor(new Date())));
  const entry = { round, governorId: "70000001", gameName: "Test", allianceTag: null, verified: false, power: null, amounts: { ...NO_AMOUNTS, truegold: 1 }, slots: { 1: [0] }, locale: "en", deviceHash: "abc" };

  it("opens the next round with demo players", async () => {
    const store = memoryMinistryStore();
    expect((await store.settings())[round]).toEqual({ open: true, deadlines: {} });
    expect(await store.count(round)).toBeGreaterThan(0);
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
