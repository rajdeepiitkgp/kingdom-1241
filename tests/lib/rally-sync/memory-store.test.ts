// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { beforeEach, describe, expect, it } from "vitest";
import { memoryStore } from "@/lib/rally-sync/memory-store";
import { MAX_INSTANCES_PER_ROOM, MAX_LEADERS_PER_ROOM, MAX_LEADERS_TOTAL, MAX_OPEN_ROOMS } from "@/lib/rally-sync/room";
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

  it("caps instances per room, removes one or all but one, and forgets them with the room", async () => {
    const store = memoryStore();
    const created = await store.insertRoom(room("AAAAAA"));
    const instances = [];
    for (let i = 0; i < MAX_INSTANCES_PER_ROOM; i++) instances.push(await store.insertInstance({ roomId: created.id, tag: "K7M4" }));
    await expect(store.insertInstance({ roomId: created.id, tag: "K7M4" })).rejects.toMatchObject({ problem: "instance_limit" });

    // A leader added from a removed instance stays, without its instance.
    const leader = await store.insertLeader({ roomId: created.id, name: "Rudy", marchSeconds: 60, tokenHash: "t", instanceId: instances[1].id });
    expect(await store.deleteInstances(created.id, { ids: [instances[1].id] })).toBe(1);
    expect(await store.instanceById(instances[1].id)).toBeNull();
    expect((await store.leaders(created.id)).find((l) => l.id === leader.id)?.instanceId).toBeNull();

    expect(await store.deleteInstances(created.id, { except: instances[0].id })).toBe(MAX_INSTANCES_PER_ROOM - 2);
    expect((await store.instances(created.id)).map((i) => i.id)).toEqual([instances[0].id]);

    await store.deleteRoom(created.id);
    expect(await store.instanceById(instances[0].id)).toBeNull();
  });

  it("writes a room only if nobody wrote it since it was read (compare-and-swap)", async () => {
    const store = memoryStore();
    const created = await store.insertRoom(room("AAAAAA"));
    expect(await store.updateRoomIf(created.id, created.updatedAt, { title: "first" })).toBe(true);
    // A second write based on the same read loses and has to read again.
    expect(await store.updateRoomIf(created.id, created.updatedAt, { title: "second" })).toBe(false);
    const fresh = await store.roomById(created.id);
    expect(fresh?.title).toBe("first");
    expect(await store.updateRoomIf(created.id, fresh?.updatedAt ?? "", { title: "second" })).toBe(true);
  });

  it("has a demo garrison room with placeholder enemy leaders", async () => {
    const store = memoryStore();
    const demo = await store.roomByCode("DEFEND");
    expect(demo).toMatchObject({ mode: "garrison", garrison: { rallies: [] } });
    expect(demo?.garrison.enemies.map((e) => e.marchSeconds)).toEqual([42, 38, 45]);
    expect(await store.leaders(demo?.id ?? "")).toEqual([]);
  });

  it("has a demo counter-rally room with placeholder leaders", async () => {
    const store = memoryStore();
    const demo = await store.roomByCode("CNTR22");
    expect(demo).toMatchObject({ mode: "counter", hitAt: null });
    expect((await store.leaders(demo?.id ?? "")).map((l) => l.marchSeconds).sort()).toEqual([40, 45, 52]);
  });
});
