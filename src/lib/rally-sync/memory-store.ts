// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { randomUUID } from "node:crypto";
import { hashPassword, hashToken } from "./access";
import { DEFAULT_SETTINGS, isRoomOpen, MAX_LEADERS_PER_ROOM, MAX_LEADERS_TOTAL, MAX_OPEN_ROOMS } from "./room";
import { type LeaderRow, RallyStoreError, type RallyStore, type RoomRow } from "./store-types";

/**
 * Rally Sync without a database, for reviewing the pages locally
 * (RALLY_SYNC_STORE=memory; ignored on Vercel). Rooms live in this server
 * process only and vanish on restart; the limits behave like the database's
 * triggers. There is no Realtime here, so pages poll.
 *
 * A demo room is always there to try (a minute after it is destroyed or closes, it comes back):
 *   /tools/rally-sync/TEST23                                     password "review123"
 *   /tools/rally-sync/TEST23#c=local-review-coordinator          … as its coordinator
 */

export const DEMO_ROOM = { code: "TEST23", password: "review123", coordinatorToken: "local-review-coordinator" };

interface Memory {
  rooms: Map<string, RoomRow>;
  leaders: Map<string, LeaderRow>;
  /** When the demo room was last deleted (its pages should see "closed" for a while, not a fresh room). */
  demoGoneAt: number;
}

// Route handlers and Server Actions are separate bundles: one copy on globalThis.
const holder = globalThis as typeof globalThis & { __rallySyncMemory?: Memory };

function memory(): Memory {
  holder.__rallySyncMemory ??= { rooms: new Map(), leaders: new Map(), demoGoneAt: 0 };
  return holder.__rallySyncMemory;
}

const iso = () => new Date().toISOString();

function openRooms(m: Memory, now: number): RoomRow[] {
  return [...m.rooms.values()].filter((r) => isRoomOpen(r, now));
}

/** The demo room with three placeholder leaders (outside the room limit, like a room created before it was reached). */
async function demoRoom(m: Memory): Promise<RoomRow> {
  const now = new Date().toISOString();
  const room: RoomRow = {
    ...DEFAULT_SETTINGS,
    id: randomUUID(),
    code: DEMO_ROOM.code,
    title: "Demo room (local review)",
    passwordHash: await hashPassword(DEMO_ROOM.password),
    coordinatorHash: hashToken(DEMO_ROOM.coordinatorToken),
    channelKey: "local-review",
    enemyHitAt: null,
    hitAt: null,
    hitSetAt: null,
    history: [],
    createdBy: null,
    createdByName: "Local review",
    lastSeenAt: now,
    createdAt: now,
  };
  m.rooms.set(room.id, room);
  for (const [name, marchSeconds] of [
    ["Demo leader A", 42],
    ["Demo leader B", 95],
    ["Demo leader C", 61],
  ] as const) {
    const leader: LeaderRow = { id: randomUUID(), roomId: room.id, name, marchSeconds, previousMarchSeconds: null, marchChangedAt: null, tokenHash: null, createdAt: now };
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
      return room ?? (code === DEMO_ROOM.code && Date.now() - m.demoGoneAt > 60_000 ? demoRoom(m) : null);
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
      if (openRooms(m, Date.now()).length >= MAX_OPEN_ROOMS) throw new RallyStoreError("room_limit", "rally_sync_room_limit");
      if ([...m.rooms.values()].some((r) => r.code === room.code)) throw new RallyStoreError("duplicate", "duplicate code");
      const now = iso();
      const row: RoomRow = { ...room, id: randomUUID(), enemyHitAt: null, hitAt: null, hitSetAt: null, history: [], lastSeenAt: now, createdAt: now };
      m.rooms.set(row.id, row);
      return row;
    },
    async updateRoom(id, patch) {
      const room = m.rooms.get(id);
      if (room) m.rooms.set(id, { ...room, ...patch });
    },
    async touchRoom(id, now) {
      const room = m.rooms.get(id);
      if (room && Date.parse(room.lastSeenAt) < now - 60_000) m.rooms.set(id, { ...room, lastSeenAt: new Date(now).toISOString() });
    },
    async deleteRoom(id) {
      if (m.rooms.get(id)?.code === DEMO_ROOM.code) m.demoGoneAt = Date.now();
      m.rooms.delete(id);
      for (const [leaderId, leader] of m.leaders) if (leader.roomId === id) m.leaders.delete(leaderId);
    },
    async insertLeader(leader) {
      const now = Date.now();
      const room = m.rooms.get(leader.roomId);
      if (!room || !isRoomOpen(room, now)) throw new RallyStoreError("room_closed", "rally_sync_room_closed");
      const all = [...m.leaders.values()];
      if (all.filter((l) => l.roomId === leader.roomId).length >= MAX_LEADERS_PER_ROOM) throw new RallyStoreError("leader_limit", "rally_sync_leader_limit");
      const open = new Set(openRooms(m, now).map((r) => r.id));
      if (all.filter((l) => open.has(l.roomId)).length >= MAX_LEADERS_TOTAL) throw new RallyStoreError("total_limit", "rally_sync_total_limit");
      const row: LeaderRow = { ...leader, id: randomUUID(), previousMarchSeconds: null, marchChangedAt: null, createdAt: iso() };
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
    async deleteClosedRooms(now) {
      const closed = [...m.rooms.values()].filter((r) => !isRoomOpen(r, now));
      for (const room of closed) await this.deleteRoom(room.id);
      return closed.length;
    },
  };
}
