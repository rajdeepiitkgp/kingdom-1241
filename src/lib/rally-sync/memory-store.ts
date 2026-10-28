// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { randomUUID } from "node:crypto";
import { laterStamp } from "@/lib/kvk/throttle";
import { hashPassword, hashToken } from "./access";
import { EMPTY_GARRISON, type GarrisonState } from "./garrison";
import { ACTIVE_BROWSER_MS, BROWSER_BUDGET, parseCapacity } from "./capacity";
import { DEFAULT_SETTINGS, isRoomOpen } from "./room";
import { type InstanceRow, type LeaderRow, RallyStoreError, type RallyStore, type RoomRow } from "./store-types";

/**
 * Rally Sync without a database, for reviewing the pages locally
 * (RALLY_SYNC_STORE=memory; ignored on Vercel). Rooms live in this server
 * process only and vanish on restart; the limits (and the owner's settings of
 * them) behave like the database's triggers. There is no Realtime here, so
 * pages poll.
 *
 * Three demo rooms are always there to try (a minute after one is destroyed or closes, it comes back):
 *   /tools/rally-sync/TEST23                                     password "review123"
 *   /tools/rally-sync/TEST23#c=local-review-coordinator          … as its coordinator
 *   /tools/rally-sync/DEFEND                                     a garrison room, same password and coordinator link
 *   /tools/rally-sync/CNTR22                                     a counter-rally room, same password and coordinator link
 */

export const DEMO_ROOM = { code: "TEST23", password: "review123", coordinatorToken: "local-review-coordinator" };
export const DEMO_GARRISON_ROOM = { ...DEMO_ROOM, code: "DEFEND" };
export const DEMO_COUNTER_ROOM = { ...DEMO_ROOM, code: "CNTR22" };
const DEMO_CODES = [DEMO_ROOM.code, DEMO_GARRISON_ROOM.code, DEMO_COUNTER_ROOM.code];

interface Memory {
  rooms: Map<string, RoomRow>;
  leaders: Map<string, LeaderRow>;
  instances: Map<string, InstanceRow>;
  /** The owner's limits as saved on the settings page (app_config in the database). */
  capacity: unknown;
  /** When each demo room was last deleted (its pages should see "closed" for a while, not a fresh room). */
  demoGoneAt: Record<string, number>;
}

// Route handlers and Server Actions are separate bundles: one copy on globalThis.
const holder = globalThis as typeof globalThis & { __rallySyncMemory?: Memory };

function memory(): Memory {
  holder.__rallySyncMemory ??= { rooms: new Map(), leaders: new Map(), instances: new Map(), capacity: null, demoGoneAt: {} };
  holder.__rallySyncMemory.instances ??= new Map(); // a process that started before instances existed
  if (typeof holder.__rallySyncMemory.demoGoneAt !== "object") holder.__rallySyncMemory.demoGoneAt = {};
  return holder.__rallySyncMemory;
}

const iso = () => new Date().toISOString();

function openRooms(m: Memory, now: number): RoomRow[] {
  return [...m.rooms.values()].filter((r) => isRoomOpen(r, now));
}

/** Browsers that had a room on screen recently (the ones its limit counts). */
function activeInstances(m: Memory, now: number, roomIds: ReadonlySet<string>): InstanceRow[] {
  return [...m.instances.values()].filter((i) => roomIds.has(i.roomId) && Date.parse(i.lastSeenAt) > now - ACTIVE_BROWSER_MS);
}

/** Placeholder enemy rally leaders of the demo garrison room. */
const DEMO_ENEMIES: GarrisonState = {
  enemies: [
    ["Demo enemy A", 42],
    ["Demo enemy B", 38],
    ["Demo enemy C", 45],
  ].map(([name, marchSeconds], i) => ({ id: `demo-enemy-${i + 1}`, name: String(name), marchSeconds: Number(marchSeconds), active: true, previousMarchSeconds: null, marchChangedAt: null })),
  rallies: [],
};

/**
 * A demo room (outside the room limit, like a room created before it was reached): the rally room and the
 * counter-rally room with three placeholder leaders, or the garrison room with three placeholder enemy leaders.
 */
async function demoRoom(m: Memory, code: string): Promise<RoomRow> {
  const now = new Date().toISOString();
  const garrison = code === DEMO_GARRISON_ROOM.code;
  const counter = code === DEMO_COUNTER_ROOM.code;
  const room: RoomRow = {
    ...DEFAULT_SETTINGS,
    ...(garrison ? { mode: "garrison" as const } : counter ? { mode: "counter" as const } : {}),
    id: randomUUID(),
    code,
    title: garrison ? "Demo garrison (local review)" : counter ? "Demo counter-rally (local review)" : "Demo room (local review)",
    passwordHash: await hashPassword(DEMO_ROOM.password),
    coordinatorHash: hashToken(DEMO_ROOM.coordinatorToken),
    channelKey: "local-review",
    enemyHitAt: null,
    hitAt: null,
    hitSetAt: null,
    history: [],
    garrison: garrison ? DEMO_ENEMIES : EMPTY_GARRISON,
    createdBy: null,
    createdByName: "Local review",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  };
  m.rooms.set(room.id, room);
  if (garrison) return room;
  const demoLeaders = counter
    ? [
        ["Demo counter A", 45],
        ["Demo counter B", 52],
        ["Demo counter C", 40],
      ]
    : [
        ["Demo leader A", 42],
        ["Demo leader B", 95],
        ["Demo leader C", 61],
      ];
  for (const [name, marchSeconds] of demoLeaders as Array<[string, number]>) {
    const leader: LeaderRow = { id: randomUUID(), roomId: room.id, name, marchSeconds, status: "active", nextMarchSeconds: null, previousMarchSeconds: null, marchChangedAt: null, tokenHash: null, instanceId: null, createdAt: now };
    m.leaders.set(leader.id, leader);
  }
  return room;
}

export function memoryStore(): RallyStore {
  const m = memory();
  return {
    kind: "memory",
    async roomByCode(code) {
      const room = [...m.rooms.values()].find((r) => r.code === code) ?? null;
      return room ?? (DEMO_CODES.includes(code) && Date.now() - (m.demoGoneAt[code] ?? 0) > 60_000 ? demoRoom(m, code) : null);
    },
    async roomById(id) {
      return m.rooms.get(id) ?? null;
    },
    async listRooms() {
      return [...m.rooms.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async leaders(roomId) {
      return [...m.leaders.values()].filter((l) => l.roomId === roomId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async leaderCounts(roomIds) {
      return new Map(roomIds.map((id) => [id, [...m.leaders.values()].filter((l) => l.roomId === id).length]));
    },
    async insertRoom(room) {
      const limit = parseCapacity(m.capacity)[room.mode].rooms;
      if (openRooms(m, Date.now()).filter((r) => r.mode === room.mode).length >= limit) throw new RallyStoreError("room_limit", "rally_sync_room_limit");
      if ([...m.rooms.values()].some((r) => r.code === room.code)) throw new RallyStoreError("duplicate", "duplicate code");
      const now = iso();
      const row: RoomRow = { ...room, id: randomUUID(), enemyHitAt: null, hitAt: null, hitSetAt: null, history: [], garrison: EMPTY_GARRISON, lastSeenAt: now, createdAt: now, updatedAt: now };
      m.rooms.set(row.id, row);
      return row;
    },
    async updateRoom(id, patch) {
      const room = m.rooms.get(id);
      if (room) m.rooms.set(id, { ...room, ...patch, updatedAt: laterStamp(room.updatedAt, Date.now()) });
    },
    async updateRoomIf(id, updatedAt, patch) {
      const room = m.rooms.get(id);
      if (!room || room.updatedAt !== updatedAt) return false;
      m.rooms.set(id, { ...room, ...patch, updatedAt: laterStamp(room.updatedAt, Date.now()) });
      return true;
    },
    async touchRoom(id, now) {
      const room = m.rooms.get(id);
      if (room && Date.parse(room.lastSeenAt) < now - 60_000) m.rooms.set(id, { ...room, lastSeenAt: new Date(now).toISOString(), updatedAt: laterStamp(room.updatedAt, now) });
    },
    async deleteRoom(id) {
      const code = m.rooms.get(id)?.code;
      if (code && DEMO_CODES.includes(code)) m.demoGoneAt[code] = Date.now();
      m.rooms.delete(id);
      for (const [leaderId, leader] of m.leaders) if (leader.roomId === id) m.leaders.delete(leaderId);
      for (const [instanceId, instance] of m.instances) if (instance.roomId === id) m.instances.delete(instanceId);
    },
    async insertLeader(leader) {
      const now = Date.now();
      const room = m.rooms.get(leader.roomId);
      if (!room || !isRoomOpen(room, now)) throw new RallyStoreError("room_closed", "rally_sync_room_closed");
      const limit = parseCapacity(m.capacity)[room.mode].leaders;
      if ([...m.leaders.values()].filter((l) => l.roomId === leader.roomId).length >= limit) throw new RallyStoreError("leader_limit", "rally_sync_leader_limit");
      const row: LeaderRow = { ...leader, status: leader.status ?? "active", instanceId: leader.instanceId ?? null, id: randomUUID(), nextMarchSeconds: null, previousMarchSeconds: null, marchChangedAt: null, createdAt: iso() };
      m.leaders.set(row.id, row);
      return row;
    },
    async updateLeader(id, patch) {
      const leader = m.leaders.get(id);
      if (leader) m.leaders.set(id, { ...leader, ...patch });
    },
    async deleteLeader(id) {
      m.leaders.delete(id);
    },
    async instances(roomId) {
      return [...m.instances.values()].filter((i) => i.roomId === roomId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async instanceById(id) {
      return m.instances.get(id) ?? null;
    },
    async insertInstance(instance) {
      const now = Date.now();
      const room = m.rooms.get(instance.roomId);
      if (!room || !isRoomOpen(room, now)) throw new RallyStoreError("room_closed", "rally_sync_room_closed");
      const limit = parseCapacity(m.capacity)[room.mode].browsers;
      const everyOpenRoom = new Set(openRooms(m, now).map((r) => r.id));
      if (activeInstances(m, now, new Set([room.id])).length >= limit || activeInstances(m, now, everyOpenRoom).length >= BROWSER_BUDGET) {
        throw new RallyStoreError("instance_limit", "rally_sync_instance_limit");
      }
      const at = iso();
      const row: InstanceRow = { ...instance, id: randomUUID(), name: null, coordinator: false, createdAt: at, lastSeenAt: at };
      m.instances.set(row.id, row);
      return row;
    },
    async updateInstance(id, patch) {
      const instance = m.instances.get(id);
      if (instance) m.instances.set(id, { ...instance, ...patch });
    },
    async touchInstance(id, now) {
      const instance = m.instances.get(id);
      if (instance && Date.parse(instance.lastSeenAt) < now - 60_000) m.instances.set(id, { ...instance, lastSeenAt: new Date(now).toISOString() });
    },
    async deleteInstances(roomId, which) {
      const doomed = [...m.instances.values()].filter(
        (i) => i.roomId === roomId && ("ids" in which ? which.ids.includes(i.id) : i.id !== which.except),
      );
      for (const instance of doomed) {
        m.instances.delete(instance.id);
        for (const leader of m.leaders.values()) if (leader.instanceId === instance.id) m.leaders.set(leader.id, { ...leader, instanceId: null });
      }
      return doomed.length;
    },
    async deleteClosedRooms(now) {
      const closed = [...m.rooms.values()].filter((r) => !isRoomOpen(r, now));
      for (const room of closed) await this.deleteRoom(room.id);
      return closed.length;
    },
    async activeInstanceCounts(roomIds, since) {
      const counts = new Map<string, number>(roomIds.map((id) => [id, 0]));
      for (const instance of m.instances.values()) {
        if (counts.has(instance.roomId) && Date.parse(instance.lastSeenAt) > since) counts.set(instance.roomId, (counts.get(instance.roomId) ?? 0) + 1);
      }
      return counts;
    },
    async readCapacity() {
      return m.capacity ?? null;
    },
    async writeCapacity(capacity) {
      m.capacity = capacity;
    },
  };
}
