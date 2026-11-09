// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Capacity } from "./capacity";
import type { GarrisonState } from "./garrison";
import type { HitHistoryEntry, LeaderStatus, RoomMode } from "./room";

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
  /** Garrison mode (migration 0015): enemy leaders and incoming rallies. */
  garrison: GarrisonState;
  createdBy: string | null;
  createdByName: string | null;
  lastSeenAt: string;
  createdAt: string;
  /** Changes with every write (database trigger): the compare-and-swap of updateRoomIf. */
  updatedAt: string;
}

export interface LeaderRow {
  id: string;
  roomId: string;
  name: string;
  marchSeconds: number;
  status: LeaderStatus;
  nextMarchSeconds: number | null;
  previousMarchSeconds: number | null;
  marchChangedAt: string | null;
  tokenHash: string | null;
  /** The instance (browser) that added this leader; null when the coordinator added it, or that instance was removed. */
  instanceId: string | null;
  createdAt: string;
}

/** One browser in a room (migration 0014): what the room cookie names, and what the coordinator can remove. */
export interface InstanceRow {
  id: string;
  roomId: string;
  /** Random 4-character label for an instance without a name ("Watcher K7M4"). */
  tag: string;
  /** Set by the instance itself; null until it does. */
  name: string | null;
  /** Has used coordinator rights. */
  coordinator: boolean;
  createdAt: string;
  lastSeenAt: string;
}

/** One chat message of a room (migration 0025): kept as written, deleted with the room. */
export interface MessageRow {
  id: number;
  roomId: string;
  /** The browser that sent it; null once that browser was removed. */
  instanceId: string | null;
  /** How the sender was called when it was sent (own name, else its leaders' names); null for a watcher (shown by its tag). */
  author: string | null;
  tag: string;
  coordinator: boolean;
  body: string;
  /** The coordinator pinned it (one per room): it stays on top of the chat and under the room's status line. */
  pinned: boolean;
  createdAt: string;
}

export type NewMessage = Pick<MessageRow, "roomId" | "instanceId" | "author" | "tag" | "coordinator" | "body">;

export type NewRoom = Pick<
  RoomRow,
  "code" | "title" | "passwordHash" | "coordinatorHash" | "channelKey" | "mode" | "rallyWaitSeconds" | "bufferSeconds" | "counterOffsetSeconds" | "createdBy" | "createdByName"
>;
export type RoomPatch = Partial<
  Pick<RoomRow, "title" | "passwordHash" | "coordinatorHash" | "mode" | "rallyWaitSeconds" | "bufferSeconds" | "counterOffsetSeconds" | "enemyHitAt" | "hitAt" | "hitSetAt" | "history" | "garrison">
>;
export type NewLeader = Pick<LeaderRow, "roomId" | "name" | "marchSeconds" | "tokenHash"> & { status?: LeaderStatus; instanceId?: string | null };
export type LeaderPatch = Partial<Pick<LeaderRow, "name" | "marchSeconds" | "status" | "nextMarchSeconds" | "previousMarchSeconds" | "marchChangedAt">>;

export type InstancePatch = Partial<Pick<InstanceRow, "name" | "coordinator">>;

/**
 * Why a write was refused. The first four come from the database's limits;
 * `not_migrated` means the table isn't there yet (a deploy that ran ahead of its migration).
 */
export type StoreProblem = "room_limit" | "leader_limit" | "instance_limit" | "room_closed" | "duplicate" | "not_migrated" | "failed";

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
  /** Writes only if the room is unchanged since it was read (`updatedAt`); false when somebody wrote in between. */
  updateRoomIf(id: string, updatedAt: string, patch: RoomPatch): Promise<boolean>;
  /** Somebody has the room on screen: bump last_seen_at (at most once a minute, so open pages don't write on every poll). */
  touchRoom(id: string, now: number): Promise<void>;
  deleteRoom(id: string): Promise<void>;
  insertLeader(leader: NewLeader): Promise<LeaderRow>;
  updateLeader(id: string, patch: LeaderPatch): Promise<void>;
  deleteLeader(id: string): Promise<void>;
  instances(roomId: string): Promise<InstanceRow[]>;
  instanceById(id: string): Promise<InstanceRow | null>;
  insertInstance(instance: Pick<InstanceRow, "roomId" | "tag">): Promise<InstanceRow>;
  updateInstance(id: string, patch: InstancePatch): Promise<void>;
  /** The instance has the room on screen: bump last_seen_at (at most once a minute, and without a Realtime ping). */
  touchInstance(id: string, now: number): Promise<void>;
  /** Removes instances of the room: the given ones, or with `except` every other one. Returns how many. */
  deleteInstances(roomId: string, which: { ids: readonly string[] } | { except: string | null }): Promise<number>;
  /** The room's messages after `afterId` (0 for all it keeps), oldest first, at most `limit`. */
  messages(roomId: string, afterId: number, limit: number): Promise<MessageRow[]>;
  insertMessage(message: NewMessage): Promise<MessageRow>;
  /** The room's pinned message, if any. */
  pinnedMessage(roomId: string): Promise<MessageRow | null>;
  /** Pins one message of the room (unpinning the one before), or with null unpins; false when the message isn't the room's. */
  pinMessage(roomId: string, messageId: number | null): Promise<boolean>;
  /** The coordinator clears the chat: every message of the room. Returns how many. */
  deleteMessages(roomId: string): Promise<number>;
  /** Deletes rooms that are closed at `now`; returns how many. */
  deleteClosedRooms(now: number): Promise<number>;
  /** Browsers per room that had it on screen since `since` (ms), for the owner's "open now". */
  activeInstanceCounts(roomIds: readonly string[], since: number): Promise<Map<string, number>>;
  /** The owner's limits as stored (app_config, migration 0016), unparsed; null when none are saved. */
  readCapacity(): Promise<unknown>;
  writeCapacity(capacity: Capacity): Promise<void>;
}
