/**
 * Deletes battle feedback whose retention period is over and closes those
 * forms (src/lib/retro/prune.ts), and Rally Sync rooms that are closed
 * (src/lib/rally-sync/prune.ts; pg_cron does that every five minutes where it
 * is available, this is the backstop), and the content editor's images that no
 * text uses any more (src/lib/content/image-store.ts). Run daily by the
 * Maintenance workflow.
 *
 *   npm run prune                 # delete what is due, one audit_log entry per battle
 *   npm run prune -- --dry-run    # only show what would be deleted
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.
 */
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));

async function main() {
  const [{ createAdminClient }, { pruneExpiredResponses }, { pruneClosedRooms }, { pruneUnusedImages }, { writeConfig }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/retro/prune"),
    import("@/lib/rally-sync/prune"),
    import("@/lib/content/image-store"),
    import("@/lib/config/app-config"),
  ]);
  const dryRun = Boolean(args["dry-run"]);
  const admin = createAdminClient();
  const results = await pruneExpiredResponses(admin, new Date(), { dryRun, log: (line) => console.log(line) });
  const deleted = results.reduce((n, r) => n + r.deleted, 0);
  console.log(`\n${dryRun ? "Dry run: " : ""}${results.length} retrospective${results.length === 1 ? "" : "s"} past retention, ${deleted} response${deleted === 1 ? "" : "s"}${dryRun ? " would be" : ""} deleted.`);
  const rooms = await pruneClosedRooms(admin, new Date(), { dryRun });
  console.log(`${dryRun ? "Dry run: " : ""}${rooms} closed Rally Sync room${rooms === 1 ? "" : "s"}${dryRun ? " would be" : ""} deleted.`);
  const images = await pruneUnusedImages(admin, new Date(), { dryRun });
  console.log(`${dryRun ? "Dry run: " : ""}${images.deleted} unused image${images.deleted === 1 ? "" : "s"} (${Math.round(images.bytes / 1024)} KB)${dryRun ? " would be" : ""} deleted.`);
  if (dryRun) return;
  // When the last prune ran, for the owner's Usage tab; never fails the prune.
  try {
    await writeConfig(admin, "last_prune", { at: new Date().toISOString(), responses: deleted, rooms, images: images.deleted });
  } catch (error) {
    console.warn(`Could not note the prune for the Usage tab: ${error instanceof Error ? error.message : String(error)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
