import type { HitHistoryEntry, RoomMode } from "./room";

/** Rows and the storage interface of Rally Sync (implementations in store.ts and memory-store.ts). */

export interface RoomRow {
  id: string;
  code: string;
  title: string;
  passwordHash: string;
  coordinatorHash: string;
  channelKey: string;
  mode: RoomMode;
  rallyWaitSeconds: number;
  bufferSeconds: number;
  counterOffsetSeconds: number;
  enemyHitAt: string | null;
  hitAt: string | null;
  hitSetAt: string | null;
  history: HitHistoryEntry[];
  createdBy: string | null;
  createdByName: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface LeaderRow {
  id: string;
  roomId: string;
  name: string;
  marchSeconds: number;
  previousMarchSeconds: number | null;
  marchChangedAt: string | null;
  tokenHash: string | null;
  createdAt: string;
}

export type NewRoom = Pick<
  RoomRow,
  "code" | "title" | "passwordHash" | "coordinatorHash" | "channelKey" | "mode" | "rallyWaitSeconds" | "bufferSeconds" | "counterOffsetSeconds" | "createdBy" | "createdByName"
>;
export type RoomPatch = Partial<
  Pick<RoomRow, "title" | "passwordHash" | "coordinatorHash" | "mode" | "rallyWaitSeconds" | "bufferSeconds" | "counterOffsetSeconds" | "enemyHitAt" | "hitAt" | "hitSetAt" | "history">
>;
export type NewLeader = Pick<LeaderRow, "roomId" | "name" | "marchSeconds" | "tokenHash">;
export type LeaderPatch = Partial<Pick<LeaderRow, "name" | "marchSeconds" | "previousMarchSeconds" | "marchChangedAt">>;

/** Why a write was refused. The first four come from the database's limits. */
export type StoreProblem = "room_limit" | "leader_limit" | "total_limit" | "room_closed" | "duplicate" | "failed";

export class RallyStoreError extends Error {
  constructor(
    readonly problem: StoreProblem,
    message: string,
  ) {
    super(message);
  }
}

export interface RallyStore {
  kind: "supabase" | "memory";
  roomByCode(code: string): Promise<RoomRow | null>;
  roomById(id: string): Promise<RoomRow | null>;
  listRooms(): Promise<RoomRow[]>;
  leaders(roomId: string): Promise<LeaderRow[]>;
  /** Leaders per room, for the admin list and the limits. */
  leaderCounts(roomIds: readonly string[]): Promise<Map<string, number>>;
  insertRoom(room: NewRoom): Promise<RoomRow>;
  updateRoom(id: string, patch: RoomPatch): Promise<void>;
  /** Somebody has the room on screen: bump last_seen_at (at most once a minute, so open pages don't write on every poll). */
  touchRoom(id: string, now: number): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  insertLeader(leader: NewLeader): Promise<LeaderRow>;
  updateLeader(id: string, patch: LeaderPatch): Promise<void>;
  deleteLeader(id: string): Promise<void>;
  /** Deletes rooms that are closed at `now`; returns how many. */
  deleteClosedRooms(now: number): Promise<number>;
}
