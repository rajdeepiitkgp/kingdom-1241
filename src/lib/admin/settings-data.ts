import { parseOwners } from "@/lib/auth/owner";
import { checkOwner } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { ACTIVE_BROWSER_MS, type Capacity, CAPACITY_MODES, type CapacityUsage, DEFAULT_CAPACITY } from "@/lib/rally-sync/capacity";
import { isRoomOpen, type RoomMode } from "@/lib/rally-sync/room";
import { roomCapacity } from "@/lib/rally-sync/session";
import { rallyStore } from "@/lib/rally-sync/store";

/**
 * Uncached reads for the owner's settings page (server only). Nothing without
 * the owner's session: the page checks first, and so does this module.
 */

const log = createLogger("admin");

/** One entry of SITE_OWNER as configured (production holds exactly one, ideally the Discord user id). */
export interface OwnerEntry {
  kind: "discord_id" | "discord_handle" | "email";
  value: string;
}

export interface RallyCapacitySettings {
  /** False without a database, or when it can't be read. */
  available: boolean;
  capacity: Capacity;
  /** What is open right now, per type. */
  usage: Record<RoomMode, CapacityUsage>;
}

export interface OwnerSettings {
  owners: OwnerEntry[];
  rally: RallyCapacitySettings;
}

export async function getOwnerSettings(): Promise<OwnerSettings | null> {
  const access = await checkOwner();
  if ("denied" in access) {
    log.warn("Owner settings requested without access", { reason: access.denied });
    return null;
  }
  const owners: OwnerEntry[] = parseOwners(process.env.SITE_OWNER).map((owner) =>
    owner.discordId
      ? { kind: "discord_id", value: owner.discordId }
      : owner.discordUsername
        ? { kind: "discord_handle", value: owner.discordUsername }
        : { kind: "email", value: owner.email ?? "" },
  );
  return { owners, rally: await rallyCapacitySettings() };
}

function noUsage(): Record<RoomMode, CapacityUsage> {
  return Object.fromEntries(CAPACITY_MODES.map((mode) => [mode, { rooms: 0, browsers: 0, leaders: 0 }])) as Record<RoomMode, CapacityUsage>;
}

async function rallyCapacitySettings(): Promise<RallyCapacitySettings> {
  const store = rallyStore();
  if (!store) return { available: false, capacity: DEFAULT_CAPACITY, usage: noUsage() };
  try {
    const now = Date.now();
    const [rooms, capacity] = await Promise.all([store.listRooms(), roomCapacity(store)]);
    const open = rooms.filter((room) => isRoomOpen(room, now));
    const ids = open.map((room) => room.id);
    const [browsers, leaders] = await Promise.all([store.activeInstanceCounts(ids, now - ACTIVE_BROWSER_MS), store.leaderCounts(ids)]);
    const usage = noUsage();
    for (const room of open) {
      usage[room.mode].rooms += 1;
      usage[room.mode].browsers += browsers.get(room.id) ?? 0;
      usage[room.mode].leaders += leaders.get(room.id) ?? 0;
    }
    return { available: true, capacity, usage };
  } catch (error) {
    log.error("Could not read the Rally Sync usage", { error: error instanceof Error ? error.message : String(error) });
    return { available: false, capacity: DEFAULT_CAPACITY, usage: noUsage() };
  }
}
