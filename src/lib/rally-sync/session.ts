// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { createLogger } from "@/lib/log";
import { instanceIdFromCookie, isValidRoomToken, roomCookieName } from "./access";
import { type Capacity, DEFAULT_CAPACITY, parseCapacity } from "./capacity";
import { isRoomOpen, type LeaderView, normalizeRoomCode, type RoomState, type RoomView } from "./room";
import { type InstanceRow, type LeaderRow, type RallyStore, rallyStore, RallyStoreError, type RoomRow } from "./store";

/**
 * Opening a Rally Sync room on the server (the page gate, the state route and
 * every action go through here): find it by code, treat a closed room as gone
 * (and delete it on the spot), check the visitor's cookie (which names their
 * instance), and turn rows into what a page may see.
 */

export type RoomProblem = "missing" | "closed" | "unavailable";

const log = createLogger("rally-sync");

export async function findOpenRoom(code: unknown, now = Date.now()): Promise<{ store: RallyStore; room: RoomRow } | { problem: RoomProblem }> {
  const store = rallyStore();
  if (!store) return { problem: "unavailable" };
  const normalized = normalizeRoomCode(code);
  if (!normalized) return { problem: "missing" };
  try {
    const room = await store.roomByCode(normalized);
    if (!room) return { problem: "missing" };
    if (!isRoomOpen(room, now)) {
      await store.deleteRoom(room.id).catch(() => undefined);
      log.info("Room closed for inactivity", { room: room.code });
      return { problem: "closed" };
    }
    return { store, room };
  } catch {
    return { problem: "unavailable" };
  }
}

/**
 * The visitor's way into the room: their instance (a signed cookie naming an
 * instance of this room that still exists), `{ instance: null }` for a cookie
 * from before instances existed (valid while the password is unchanged), or
 * null when they have to unlock.
 */
export async function roomAccess(store: RallyStore, room: RoomRow): Promise<{ instance: InstanceRow | null } | null> {
  const token = (await cookies()).get(roomCookieName(room.code))?.value;
  const instanceId = instanceIdFromCookie(token, room.id);
  if (instanceId) {
    try {
      const instance = await store.instanceById(instanceId);
      return instance && instance.roomId === room.id ? { instance } : null;
    } catch (error) {
      if (error instanceof RallyStoreError && error.problem === "not_migrated") return null;
      throw error;
    }
  }
  return isValidRoomToken(token, room.id, room.passwordHash) ? { instance: null } : null;
}

export function roomView(room: RoomRow): RoomView {
  return {
    code: room.code,
    title: room.title,
    mode: room.mode,
    rallyWaitSeconds: room.rallyWaitSeconds,
    bufferSeconds: room.bufferSeconds,
    counterOffsetSeconds: room.counterOffsetSeconds,
    enemyHitAt: room.enemyHitAt,
    hitAt: room.hitAt,
    hitSetAt: room.hitSetAt,
    history: room.history,
    garrison: room.garrison,
    channel: `rally:${room.channelKey}`,
    createdAt: room.createdAt,
    lastSeenAt: room.lastSeenAt,
  };
}

export function leaderView(leader: LeaderRow): LeaderView {
  return {
    id: leader.id,
    name: leader.name,
    marchSeconds: leader.marchSeconds,
    status: leader.status,
    nextMarchSeconds: leader.nextMarchSeconds,
    previousMarchSeconds: leader.previousMarchSeconds,
    marchChangedAt: leader.marchChangedAt,
  };
}

/** The owner's limits, read right before a write (the database checks them again); the defaults when they can't be read. */
export async function roomCapacity(store: RallyStore): Promise<Capacity> {
  try {
    return parseCapacity(await store.readCapacity());
  } catch {
    return DEFAULT_CAPACITY;
  }
}

/** The same for what pages show ("3/10 leaders"): cached, since every open page refetches after each change; saving the settings expires it. */
async function shownCapacity(): Promise<Capacity> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.config);
  const store = rallyStore();
  return store ? roomCapacity(store) : DEFAULT_CAPACITY;
}

/** The room as its page sees it; counts as somebody (this instance) looking at it. */
export async function roomState(store: RallyStore, room: RoomRow, instance: InstanceRow | null): Promise<RoomState> {
  const now = Date.now();
  const [leaders, capacity] = await Promise.all([
    store.leaders(room.id),
    shownCapacity(),
    store.touchRoom(room.id, now),
    instance ? store.touchInstance(instance.id, now) : undefined,
  ]);
  const seen = Date.parse(room.lastSeenAt) < now - 60_000 ? new Date(now).toISOString() : room.lastSeenAt;
  return {
    room: { ...roomView(room), lastSeenAt: seen },
    leaders: leaders.map(leaderView),
    leaderLimit: capacity[room.mode].leaders,
    me: instance ? { tag: instance.tag, name: instance.name } : null,
    serverNow: Date.now(),
  };
}
