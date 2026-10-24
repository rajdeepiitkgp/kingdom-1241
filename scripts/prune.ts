/**
 * Deletes battle feedback whose retention period is over and closes those
 * forms (src/lib/retro/prune.ts). Run daily by the Maintenance workflow.
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
  const [{ createAdminClient }, { pruneExpiredResponses }] = await Promise.all([import("@/lib/supabase/admin"), import("@/lib/retro/prune")]);
  const dryRun = Boolean(args["dry-run"]);
  const results = await pruneExpiredResponses(createAdminClient(), new Date(), { dryRun, log: (line) => console.log(line) });
  const deleted = results.reduce((n, r) => n + r.deleted, 0);
  console.log(`\n${dryRun ? "Dry run: " : ""}${results.length} retrospective${results.length === 1 ? "" : "s"} past retention, ${deleted} response${deleted === 1 ? "" : "s"}${dryRun ? " would be" : ""} deleted.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
