// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { cookies } from "next/headers";
import { createLogger } from "@/lib/log";
import { isValidRoomToken, roomCookieName } from "./access";
import { isRoomOpen, type LeaderView, normalizeRoomCode, type RoomState, type RoomView } from "./room";
import { type LeaderRow, type RallyStore, rallyStore, type RoomRow } from "./store";

/**
 * Opening a Rally Sync room on the server (the page gate, the state route and
 * every action go through here): find it by code, treat a closed room as gone
 * (and delete it on the spot), check the visitor's cookie, and turn rows into
 * what a page may see.
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

/** Does this visitor's cookie open the room (current password)? */
export async function hasRoomAccess(room: RoomRow): Promise<boolean> {
  const token = (await cookies()).get(roomCookieName(room.code))?.value;
  return isValidRoomToken(token, room.id, room.passwordHash);
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

/** The room as its page sees it; counts as somebody looking at it. */
export async function roomState(store: RallyStore, room: RoomRow): Promise<RoomState> {
  const now = Date.now();
  const [leaders] = await Promise.all([store.leaders(room.id), store.touchRoom(room.id, now)]);
  const seen = Date.parse(room.lastSeenAt) < now - 60_000 ? new Date(now).toISOString() : room.lastSeenAt;
  return { room: { ...roomView(room), lastSeenAt: seen }, leaders: leaders.map(leaderView), serverNow: Date.now() };
}
