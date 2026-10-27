// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { IDLE_CLOSE_MS, MAX_ROOM_AGE_MS } from "./room";

/**
 * Deletes Rally Sync rooms that are closed (30 minutes without anybody on the
 * page, or a day old); their leaders go with them. pg_cron does this every
 * five minutes (migration 0012); `npm run prune` (Maintenance, daily) runs it
 * too, as the backstop when pg_cron isn't available. Framework-free so the
 * script can import it. Pages already treat a closed room as gone the moment
 * it closes, whether or not the row is deleted yet.
 */

/** Cut-offs of the "closed" rule as ISO strings (the same rule as isRoomOpen). */
export function closedCutoffs(now: Date): { lastSeenBefore: string; createdBefore: string } {
  return {
    lastSeenBefore: new Date(now.getTime() - IDLE_CLOSE_MS).toISOString(),
    createdBefore: new Date(now.getTime() - MAX_ROOM_AGE_MS).toISOString(),
  };
}

/** The table isn't there yet (migration 0012 not applied): nothing to prune. */
function missingTable(error: { code?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205";
}

/** Returns how many rooms were deleted (or would be, with `dryRun`). */
export async function pruneClosedRooms(admin: SupabaseClient, now: Date, options: { dryRun?: boolean } = {}): Promise<number> {
  const { lastSeenBefore, createdBefore } = closedCutoffs(now);
  const filter = `last_seen_at.lt.${lastSeenBefore},created_at.lt.${createdBefore}`;
  if (options.dryRun) {
    const { count, error } = await admin.from("rally_sync_rooms").select("id", { count: "exact", head: true }).or(filter);
    if (error && !missingTable(error)) throw new Error(`Could not count closed rally rooms: ${error.message}`);
    return count ?? 0;
  }
  const { data, error } = await admin.from("rally_sync_rooms").delete().or(filter).select("id");
  if (error && !missingTable(error)) throw new Error(`Could not delete closed rally rooms: ${error.message}`);
  return data?.length ?? 0;
}
