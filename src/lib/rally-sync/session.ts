// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { cacheLife, cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { createLogger } from "@/lib/log";
import { instanceIdFromCookie, isValidRoomToken, roomCookieName } from "./access";
import { type Capacity, DEFAULT_CAPACITY, parseCapacity } from "./capacity";
import { isRoomOpen, type LeaderView, nextRallyPatch, normalizeRoomCode, rallyRunning, type RoomState, type RoomView } from "./room";
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
  // Seen within the minute: nothing to bump, so no UPDATE is sent (160 garrison browsers refetch after every change).
  const stale = (seenAt: string) => Date.parse(seenAt) < now - 60_000;
  const [read, capacity] = await Promise.all([
    store.leaders(room.id),
    shownCapacity(),
    stale(room.lastSeenAt) ? store.touchRoom(room.id, now) : undefined,
    instance && stale(instance.lastSeenAt) ? store.touchInstance(instance.id, now) : undefined,
  ]);
  // A rally that has landed (or none) holds nobody back: leaders in from the next rally and march times waiting
  // for it fold in here too (nextRallyPatch), not only when the coordinator sets the next hit time.
  const waiting = rallyRunning(room.hitAt, now) ? [] : read.filter((l) => nextRallyPatch(l) !== null);
  if (waiting.length > 0) await startNextRally(store, waiting);
  const leaders = waiting.length > 0 ? read.map((l) => ({ ...l, ...nextRallyPatch(l) })) : read;
  const seen = stale(room.lastSeenAt) ? new Date(now).toISOString() : room.lastSeenAt;
  return {
    room: { ...roomView(room), lastSeenAt: seen },
    leaders: leaders.map(leaderView),
    leaderLimit: capacity[room.mode].leaders,
    me: instance ? { tag: instance.tag, name: instance.name } : null,
    serverNow: Date.now(),
  };
}

/**
 * A new hit time (or none) starts the next rally: march times that waited for
 * it become the leaders' march times, and leaders who joined or came back
 * during the last one are in. Those sitting out stay out. Called after the
 * room is updated: should it fail, the leaders stay "next" under the new hit
 * (the next read or tap picks them up) instead of entering the rally that
 * still runs under the old one. Pages see both on the last ping.
 */
export async function startNextRally(store: RallyStore, leaders: readonly LeaderRow[]): Promise<void> {
  await Promise.all(
    leaders.flatMap((l) => {
      const patch = nextRallyPatch(l);
      return patch ? [store.updateLeader(l.id, patch)] : [];
    }),
  );
}
