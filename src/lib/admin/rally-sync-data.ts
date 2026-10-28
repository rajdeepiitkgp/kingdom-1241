// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { checkAccess } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { type Capacity, DEFAULT_CAPACITY } from "@/lib/rally-sync/capacity";
import { isRoomOpen, type RoomMode, roomClosesAt } from "@/lib/rally-sync/room";
import { roomCapacity } from "@/lib/rally-sync/session";
import { rallyStore } from "@/lib/rally-sync/store";

/**
 * Uncached reads for the admin Rally Sync page (server only, after the role
 * check). Hashes and tokens never leave this module.
 */

const log = createLogger("admin");

export interface AdminRallyRoom {
  id: string;
  code: string;
  title: string;
  mode: RoomMode;
  createdByName: string | null;
  createdAt: string;
  lastSeenAt: string;
  /** When it closes unless somebody opens it (ISO). */
  closesAt: string;
  open: boolean;
  leaderCount: number;
  hitAt: string | null;
}

/** Rooms newest first, open and recently closed (not yet deleted), with the owner's limits; `available` is false without a store. */
export async function listRallyRooms(): Promise<{ available: boolean; rooms: AdminRallyRoom[]; capacity: Capacity }> {
  const access = await checkAccess("moderator");
  if ("denied" in access) {
    log.warn("Admin data requested without access", { what: "rally rooms", reason: access.denied });
    return { available: false, rooms: [], capacity: DEFAULT_CAPACITY };
  }
  const store = rallyStore();
  if (!store) return { available: false, rooms: [], capacity: DEFAULT_CAPACITY };
  try {
    const [rows, capacity] = await Promise.all([store.listRooms(), roomCapacity(store)]);
    const counts = await store.leaderCounts(rows.map((r) => r.id));
    const now = Date.now();
    return {
      available: true,
      capacity,
      rooms: rows.map((room) => ({
        id: room.id,
        code: room.code,
        title: room.title,
        mode: room.mode,
        createdByName: room.createdByName,
        createdAt: room.createdAt,
        lastSeenAt: room.lastSeenAt,
        closesAt: new Date(roomClosesAt(room)).toISOString(),
        open: isRoomOpen(room, now),
        leaderCount: counts.get(room.id) ?? 0,
        hitAt: room.hitAt,
      })),
    };
  } catch (error) {
    log.error("Could not list rally rooms", { error: error instanceof Error ? error.message : String(error) });
    return { available: false, rooms: [], capacity: DEFAULT_CAPACITY };
  }
}
