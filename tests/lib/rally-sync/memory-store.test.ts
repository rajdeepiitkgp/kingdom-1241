// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CAPACITY } from "@/lib/rally-sync/capacity";
import { memoryStore } from "@/lib/rally-sync/memory-store";
import { CHAT_KEEP } from "@/lib/rally-sync/room-chat";
import type { RoomMode } from "@/lib/rally-sync/room";
import { closedCutoffs } from "@/lib/rally-sync/prune";
import type { NewRoom } from "@/lib/rally-sync/store-types";

const room = (code: string, mode: RoomMode = "rally"): NewRoom => ({
  code,
  title: "",
  passwordHash: "h",
  coordinatorHash: "c",
  channelKey: "k",
  mode,
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

  it("opens a fresh demo room for a browser test's code, of the mode its third letter names", async () => {
    const store = memoryStore();
    expect((await store.roomByCode("E2RAAB"))?.mode).toBe("rally");
    expect((await store.roomByCode("E2GAAB"))?.mode).toBe("garrison");
    expect((await store.roomByCode("E2CAAB"))?.mode).toBe("counter");
    expect((await store.roomByCode("TEST23"))?.mode).toBe("rally");
    expect((await store.roomByCode("DEFEND"))?.mode).toBe("garrison");
    // Each code is its own room with its own placeholder leaders.
    const [a, b] = [await store.roomByCode("E2RAAB"), await store.roomByCode("E2RACD")];
    expect(a?.id).not.toBe(b?.id);
    expect(await store.leaders(a!.id)).toHaveLength(3);
    expect(await store.roomByCode("E2XAAB")).toBeNull();
    expect(await store.roomByCode("K7M4QX")).toBeNull();
  });

  it("limits open rooms per type, as the owner set them", async () => {
    const store = memoryStore();
    const codes = ["AAAAAA", "BBBBBB", "CCCCCC", "DDDDDD", "EEEEEE"];
    for (const code of codes.slice(0, DEFAULT_CAPACITY.rally.rooms)) await store.insertRoom(room(code));
    await expect(store.insertRoom(room("FFFFFF"))).rejects.toMatchObject({ problem: "room_limit" });
    // The other types have their own count.
    await store.insertRoom(room("GGGGGG", "counter"));
    await expect(store.insertRoom(room("HHHHHH", "counter"))).rejects.toMatchObject({ problem: "room_limit" });
    await store.insertRoom(room("JJJJJJ", "garrison"));

    await store.writeCapacity({ ...DEFAULT_CAPACITY, counter: { ...DEFAULT_CAPACITY.counter, rooms: 2 } });
    expect(await store.readCapacity()).toMatchObject({ counter: { rooms: 2 } });
    await store.insertRoom(room("HHHHHH", "counter"));
  });

  it("caps leaders per room by its type, and takes none in a garrison room", async () => {
    const store = memoryStore();
    const a = await store.insertRoom(room("AAAAAA"));
    const b = await store.insertRoom(room("BBBBBB"));
    for (let i = 0; i < DEFAULT_CAPACITY.rally.leaders; i++) await store.insertLeader({ roomId: a.id, name: `A${i}`, marchSeconds: 40, tokenHash: null });
    await expect(store.insertLeader({ roomId: a.id, name: "extra", marchSeconds: 40, tokenHash: null })).rejects.toMatchObject({ problem: "leader_limit" });
    // No longer a limit across the open rooms.
    for (let i = 0; i < DEFAULT_CAPACITY.rally.leaders; i++) await store.insertLeader({ roomId: b.id, name: `B${i}`, marchSeconds: 40, tokenHash: null });
    const garrison = await store.insertRoom(room("CCCCCC", "garrison"));
    await expect(store.insertLeader({ roomId: garrison.id, name: "G", marchSeconds: 40, tokenHash: null })).rejects.toMatchObject({ problem: "leader_limit" });
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

  it("caps browsers per room by its type, counting only the ones seen lately", async () => {
    const store = memoryStore();
    const created = await store.insertRoom(room("AAAAAA"));
    const instances = [];
    for (let i = 0; i < DEFAULT_CAPACITY.rally.browsers; i++) instances.push(await store.insertInstance({ roomId: created.id, tag: "K7M4" }));
    await expect(store.insertInstance({ roomId: created.id, tag: "K7M4" })).rejects.toMatchObject({ problem: "instance_limit" });
    const now = Date.now();
    expect((await store.activeInstanceCounts([created.id], now - 60_000)).get(created.id)).toBe(DEFAULT_CAPACITY.rally.browsers);

    // A browser that left more than ten minutes ago frees its place.
    const memory = (globalThis as unknown as { __rallySyncMemory: { instances: Map<string, { lastSeenAt: string }> } }).__rallySyncMemory;
    const gone = memory.instances.get(instances[0].id)!;
    memory.instances.set(instances[0].id, { ...gone, lastSeenAt: new Date(now - 11 * 60_000).toISOString() });
    await store.insertInstance({ roomId: created.id, tag: "K7M4" });
  });

  it("removes one browser or all but one, and forgets them with the room", async () => {
    const store = memoryStore();
    const created = await store.insertRoom(room("AAAAAA"));
    const instances = [];
    for (let i = 0; i < 5; i++) instances.push(await store.insertInstance({ roomId: created.id, tag: "K7M4" }));

    // A leader added from a removed instance stays, without its instance.
    const leader = await store.insertLeader({ roomId: created.id, name: "Rudy", marchSeconds: 60, tokenHash: "t", instanceId: instances[1].id });
    expect(await store.deleteInstances(created.id, { ids: [instances[1].id] })).toBe(1);
    expect(await store.instanceById(instances[1].id)).toBeNull();
    expect((await store.leaders(created.id)).find((l) => l.id === leader.id)?.instanceId).toBeNull();

    expect(await store.deleteInstances(created.id, { except: instances[0].id })).toBe(3);
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

  it("keeps a room's last messages in order, forgets a removed browser on them and deletes them with the room", async () => {
    const store = memoryStore();
    const created = await store.insertRoom(room("AAAAAA"));
    const other = await store.insertRoom(room("BBBBBB"));
    const browser = await store.insertInstance({ roomId: created.id, tag: "K7M4" });
    const send = (roomId: string, body: string, instanceId: string | null = browser.id) => store.insertMessage({ roomId, instanceId, author: null, tag: "K7M4", coordinator: false, body });
    const first = await send(created.id, "first");
    await send(other.id, "elsewhere", null);
    const second = await send(created.id, "second");
    expect(second.id).toBeGreaterThan(first.id);
    expect((await store.messages(created.id, 0, 50)).map((m) => m.body)).toEqual(["first", "second"]);
    expect((await store.messages(created.id, first.id, 50)).map((m) => m.body)).toEqual(["second"]);
    expect((await store.messages(created.id, 0, 1)).map((m) => m.body)).toEqual(["first"]);

    // The room keeps its last CHAT_KEEP messages: of CHAT_KEEP + 5 sent, the first five are gone.
    for (let i = 0; i < CHAT_KEEP + 3; i++) await send(created.id, `more ${i}`);
    const kept = await store.messages(created.id, 0, CHAT_KEEP + 10);
    expect(kept).toHaveLength(CHAT_KEEP);
    expect(kept[0].body).toBe("more 3");
    expect(kept[kept.length - 1].body).toBe(`more ${CHAT_KEEP + 2}`);

    // One pinned message per room; a pinned message survives the trim; unpinning and a pin on another room's message.
    const oldest = (await store.messages(created.id, 0, 1))[0];
    expect(await store.pinMessage(created.id, oldest.id)).toBe(true);
    expect((await store.pinnedMessage(created.id))?.id).toBe(oldest.id);
    for (let i = 0; i < 25; i++) await send(created.id, `after pin ${i}`);
    expect((await store.pinnedMessage(created.id))?.id).toBe(oldest.id);
    expect(await store.messages(created.id, 0, CHAT_KEEP + 10)).toHaveLength(CHAT_KEEP + 1);
    const newest = (await store.messages(created.id, 0, 200)).at(-1)!;
    expect(await store.pinMessage(created.id, newest.id)).toBe(true);
    expect((await store.messages(created.id, 0, 200)).filter((m) => m.pinned).map((m) => m.id)).toEqual([newest.id]);
    expect(await store.pinMessage(other.id, newest.id)).toBe(false);
    expect(await store.pinMessage(created.id, null)).toBe(true);
    expect(await store.pinnedMessage(created.id)).toBeNull();

    // A removed browser's messages stay, without the browser.
    await store.deleteInstances(created.id, { ids: [browser.id] });
    expect((await store.messages(created.id, 0, 1))[0].instanceId).toBeNull();

    // Clearing and closing (the once-pinned message survived the trims, so one more than CHAT_KEEP).
    expect(await store.deleteMessages(created.id)).toBe(CHAT_KEEP + 1);
    expect(await store.messages(created.id, 0, 50)).toEqual([]);
    expect((await store.messages(other.id, 0, 50)).map((m) => m.body)).toEqual(["elsewhere"]);
    await store.deleteRoom(other.id);
    expect(await store.messages(other.id, 0, 50)).toEqual([]);
    // No message in a closed room.
    await store.deleteRoom(created.id);
    await expect(send(created.id, "late", null)).rejects.toMatchObject({ problem: "room_closed" });
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
