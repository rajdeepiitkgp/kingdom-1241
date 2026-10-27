import { beforeEach, describe, expect, it } from "vitest";
import { memoryStore } from "@/lib/rally-sync/memory-store";
import { MAX_LEADERS_PER_ROOM, MAX_LEADERS_TOTAL, MAX_OPEN_ROOMS } from "@/lib/rally-sync/room";
import { closedCutoffs } from "@/lib/rally-sync/prune";
import type { NewRoom } from "@/lib/rally-sync/store-types";

const room = (code: string): NewRoom => ({
  code,
  title: "",
  passwordHash: "h",
  coordinatorHash: "c",
  channelKey: "k",
  mode: "rally",
  rallyWaitSeconds: 300,
  bufferSeconds: 120,
  counterOffsetSeconds: 3,
  createdBy: null,
  createdByName: null,
});

describe("rally sync limits (in-memory store, same rules as the database triggers)", () => {
  beforeEach(() => {
    delete (globalThis as { __rallySyncMemory?: unknown }).__rallySyncMemory;
  });

  it("allows three open rooms and refuses a fourth", async () => {
    const store = memoryStore();
    for (const code of ["AAAAAA", "BBBBBB", "CCCCCC"].slice(0, MAX_OPEN_ROOMS)) await store.insertRoom(room(code));
    await expect(store.insertRoom(room("DDDDDD"))).rejects.toMatchObject({ problem: "room_limit" });
  });

  it("caps leaders per room and across the open rooms", async () => {
    const store = memoryStore();
    const a = await store.insertRoom(room("AAAAAA"));
    const b = await store.insertRoom(room("BBBBBB"));
    for (let i = 0; i < MAX_LEADERS_PER_ROOM; i++) await store.insertLeader({ roomId: a.id, name: `A${i}`, marchSeconds: 40, tokenHash: null });
    await expect(store.insertLeader({ roomId: a.id, name: "extra", marchSeconds: 40, tokenHash: null })).rejects.toMatchObject({ problem: "leader_limit" });
    for (let i = 0; i < MAX_LEADERS_TOTAL - MAX_LEADERS_PER_ROOM; i++) await store.insertLeader({ roomId: b.id, name: `B${i}`, marchSeconds: 40, tokenHash: null });
    await expect(store.insertLeader({ roomId: b.id, name: "extra", marchSeconds: 40, tokenHash: null })).rejects.toMatchObject({ problem: "total_limit" });
  });

  it("deletes closed rooms with their leaders", async () => {
    const store = memoryStore();
    const a = await store.insertRoom(room("AAAAAA"));
    await store.insertLeader({ roomId: a.id, name: "A", marchSeconds: 40, tokenHash: null });
    expect(await store.deleteClosedRooms(Date.now())).toBe(0);
    expect(await store.deleteClosedRooms(Date.now() + 31 * 60_000)).toBe(1);
    expect(await store.roomById(a.id)).toBeNull();
    expect(await store.leaders(a.id)).toEqual([]);
  });

  it("uses the same cut-offs for the database prune", () => {
    expect(closedCutoffs(new Date("2026-11-07T12:00:00Z"))).toEqual({ lastSeenBefore: "2026-11-07T11:30:00.000Z", createdBefore: "2026-11-06T12:00:00.000Z" });
  });
});
