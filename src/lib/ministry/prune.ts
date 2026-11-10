// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { latestDueRound } from "./ministry";

/**
 * Deletes the ministry sign-ups of prep rounds that ended two weeks ago. Run
 * by `npm run prune` (the Maintenance task `prune`, daily). Framework-free so
 * the script can import it. A database without the table yet (the deploy runs
 * ahead of migration 0026) counts as nothing to delete.
 */
export async function pruneOldSignups(admin: SupabaseClient, now: Date, options: { dryRun?: boolean } = {}): Promise<number> {
  const round = latestDueRound(now);
  if (!round) return 0;
  if (options.dryRun) {
    const { count, error } = await admin.from("ministry_signups").select("id", { count: "exact", head: true }).lte("round", round);
    if (error) return missingTable(error) ? 0 : fail(error);
    return count ?? 0;
  }
  const { data, error } = await admin.from("ministry_signups").delete().lte("round", round).select("id");
  if (error) return missingTable(error) ? 0 : fail(error);
  // The appointments went with their sign-ups; the days' "assigned" marks have no sign-up to follow (migration 0027).
  const marks = await admin.from("ministry_rosters").delete().lte("round", round);
  if (marks.error && !missingTable(marks.error)) fail(marks.error);
  return data?.length ?? 0;
}

const missingTable = (error: { code?: string }): boolean => error.code === "42P01" || error.code === "PGRST205";

function fail(error: { message: string }): never {
  throw new Error(`ministry_signups: ${error.message}`);
}
