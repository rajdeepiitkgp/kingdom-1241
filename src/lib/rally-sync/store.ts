import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { memoryStore } from "./memory-store";
import { pruneClosedRooms } from "./prune";
import { parseHistory } from "./room";
import { type LeaderPatch, type LeaderRow, RallyStoreError, type RallyStore, type RoomPatch, type RoomRow, type StoreProblem } from "./store-types";

export * from "./store-types";

/**
 * Storage of Rally Sync rooms (server only): tables rally_sync_rooms and
 * rally_sync_leaders through the service role, or an in-memory store for
 * local review without a database (RALLY_SYNC_STORE=memory, never on Vercel).
 * The database enforces the limits and broadcasts the Realtime pings
 * (migration 0012); the actions check the limits first for a friendly reply.
 */

const log = createLogger("rally-sync");

/** The store this deployment uses, or null when there is no database (the pages then say "unavailable"). */
export function rallyStore(): RallyStore | null {
  if (process.env.RALLY_SYNC_STORE === "memory" && !process.env.VERCEL) return memoryStore();
  return isSupabaseAdminConfigured() ? supabaseStore(createAdminClient()) : null;
}

const ROOM_COLUMNS =
  "id, code, title, password_hash, coordinator_hash, channel_key, mode, rally_wait_seconds, buffer_seconds, counter_offset_seconds, enemy_hit_at, hit_at, hit_set_at, hit_history, created_by, created_by_name, last_seen_at, created_at";
const LEADER_COLUMNS = "id, room_id, name, march_seconds, previous_march_seconds, march_changed_at, token_hash, created_at";

type Row = Record<string, unknown>;

const text = (v: unknown) => (typeof v === "string" ? v : "");
const optionalText = (v: unknown) => (typeof v === "string" ? v : null);
const optionalNumber = (v: unknown) => (typeof v === "number" ? v : null);

export function mapRoomRow(row: Row): RoomRow {
  return {
    id: text(row.id),
    code: text(row.code),
    title: text(row.title),
    passwordHash: text(row.password_hash),
    coordinatorHash: text(row.coordinator_hash),
    channelKey: text(row.channel_key),
    mode: row.mode === "counter" ? "counter" : "rally",
    rallyWaitSeconds: Number(row.rally_wait_seconds) || 0,
    bufferSeconds: Number(row.buffer_seconds) || 0,
    counterOffsetSeconds: Number(row.counter_offset_seconds) || 0,
    enemyHitAt: optionalText(row.enemy_hit_at),
    hitAt: optionalText(row.hit_at),
    hitSetAt: optionalText(row.hit_set_at),
    history: parseHistory(row.hit_history),
    createdBy: optionalText(row.created_by),
    createdByName: optionalText(row.created_by_name),
    lastSeenAt: text(row.last_seen_at),
    createdAt: text(row.created_at),
  };
}

export function mapLeaderRow(row: Row): LeaderRow {
  return {
    id: text(row.id),
    roomId: text(row.room_id),
    name: text(row.name),
    marchSeconds: Number(row.march_seconds) || 0,
    previousMarchSeconds: optionalNumber(row.previous_march_seconds),
    marchChangedAt: optionalText(row.march_changed_at),
    tokenHash: optionalText(row.token_hash),
    createdAt: text(row.created_at),
  };
}

const ROOM_PATCH_COLUMNS: Record<keyof RoomPatch, string> = {
  title: "title",
  passwordHash: "password_hash",
  coordinatorHash: "coordinator_hash",
  mode: "mode",
  rallyWaitSeconds: "rally_wait_seconds",
  bufferSeconds: "buffer_seconds",
  counterOffsetSeconds: "counter_offset_seconds",
  enemyHitAt: "enemy_hit_at",
  hitAt: "hit_at",
  hitSetAt: "hit_set_at",
  history: "hit_history",
};

const LEADER_PATCH_COLUMNS: Record<keyof LeaderPatch, string> = {
  name: "name",
  marchSeconds: "march_seconds",
  previousMarchSeconds: "previous_march_seconds",
  marchChangedAt: "march_changed_at",
};

function toColumns<T extends object>(patch: T, columns: Record<keyof T, string>): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) out[columns[key as keyof T]] = value;
  return out;
}

/** The database's limit errors (raised by the triggers of migration 0012) as problems. */
function problemOf(error: { message: string; code?: string }): StoreProblem {
  for (const problem of ["room_limit", "leader_limit", "total_limit", "room_closed"] as const) if (error.message.includes(`rally_sync_${problem}`)) return problem;
  return error.code === "23505" ? "duplicate" : "failed";
}

function fail(what: string, error: { message: string; code?: string }): never {
  const problem = problemOf(error);
  if (problem === "failed") log.error(`${what} failed`, { error: error.message, code: error.code });
  throw new RallyStoreError(problem, error.message);
}

function supabaseStore(admin: SupabaseClient): RallyStore {
  return {
    kind: "supabase",
    async roomByCode(code) {
      const { data, error } = await admin.from("rally_sync_rooms").select(ROOM_COLUMNS).eq("code", code).maybeSingle();
      if (error) fail("Reading a room", error);
      return data ? mapRoomRow(data) : null;
    },
    async roomById(id) {
      const { data, error } = await admin.from("rally_sync_rooms").select(ROOM_COLUMNS).eq("id", id).maybeSingle();
      if (error) fail("Reading a room", error);
      return data ? mapRoomRow(data) : null;
    },
    async listRooms() {
      const { data, error } = await admin.from("rally_sync_rooms").select(ROOM_COLUMNS).order("created_at", { ascending: false }).limit(20);
      if (error) fail("Listing rooms", error);
      return (data ?? []).map(mapRoomRow);
    },
    async leaders(roomId) {
      const { data, error } = await admin.from("rally_sync_leaders").select(LEADER_COLUMNS).eq("room_id", roomId).order("created_at").limit(50);
      if (error) fail("Reading leaders", error);
      return (data ?? []).map(mapLeaderRow);
    },
    async leaderCounts(roomIds) {
      const counts = new Map<string, number>(roomIds.map((id) => [id, 0]));
      if (roomIds.length === 0) return counts;
      const { data, error } = await admin.from("rally_sync_leaders").select("room_id").in("room_id", roomIds);
      if (error) fail("Counting leaders", error);
      for (const row of data ?? []) counts.set(String(row.room_id), (counts.get(String(row.room_id)) ?? 0) + 1);
      return counts;
    },
    async insertRoom(room) {
      const { data, error } = await admin
        .from("rally_sync_rooms")
        .insert({
          code: room.code,
          title: room.title,
          password_hash: room.passwordHash,
          coordinator_hash: room.coordinatorHash,
          channel_key: room.channelKey,
          mode: room.mode,
          rally_wait_seconds: room.rallyWaitSeconds,
          buffer_seconds: room.bufferSeconds,
          counter_offset_seconds: room.counterOffsetSeconds,
          created_by: room.createdBy,
          created_by_name: room.createdByName,
        })
        .select(ROOM_COLUMNS)
        .single();
      if (error) fail("Creating a room", error);
      return mapRoomRow(data);
    },
    async updateRoom(id, patch) {
      const { error } = await admin.from("rally_sync_rooms").update(toColumns(patch, ROOM_PATCH_COLUMNS)).eq("id", id);
      if (error) fail("Updating a room", error);
    },
    async touchRoom(id, now) {
      const { error } = await admin
        .from("rally_sync_rooms")
        .update({ last_seen_at: new Date(now).toISOString() })
        .eq("id", id)
        .lt("last_seen_at", new Date(now - 60_000).toISOString());
      if (error) log.warn("Could not mark a room as seen", { error: error.message });
    },
    async deleteRoom(id) {
      const { error } = await admin.from("rally_sync_rooms").delete().eq("id", id);
      if (error) fail("Deleting a room", error);
    },
    async insertLeader(leader) {
      const { data, error } = await admin
        .from("rally_sync_leaders")
        .insert({ room_id: leader.roomId, name: leader.name, march_seconds: leader.marchSeconds, token_hash: leader.tokenHash })
        .select(LEADER_COLUMNS)
        .single();
      if (error) fail("Adding a leader", error);
      return mapLeaderRow(data);
    },
    async updateLeader(id, patch) {
      const { error } = await admin.from("rally_sync_leaders").update(toColumns(patch, LEADER_PATCH_COLUMNS)).eq("id", id);
      if (error) fail("Updating a leader", error);
    },
    async deleteLeader(id) {
      const { error } = await admin.from("rally_sync_leaders").delete().eq("id", id);
      if (error) fail("Removing a leader", error);
    },
    async deleteClosedRooms(now) {
      return pruneClosedRooms(admin, new Date(now));
    },
  };
}
