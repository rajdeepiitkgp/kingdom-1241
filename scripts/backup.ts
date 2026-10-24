/**
 * Encrypted backup of the site's content and admin tables, and its restore.
 *
 *   npm run backup                                   # → backups/kingdom-1241-<time>.json.enc
 *   npm run backup -- --out <file>                   # same, chosen path
 *   npm run backup -- --decrypt <file> [--out <json>]   # readable copy next to it (keep it private)
 *   npm run backup -- --restore <file>               # show what the file holds
 *   npm run backup -- --restore <file> --yes [--tables guides,rules]   # write it back
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and BACKUP_PASSPHRASE
 * (16+ characters; the Maintenance workflow reads it from the GitHub secret).
 * The Maintenance workflow runs the backup every Monday and keeps the file as
 * an artifact for 90 days; SETUP.md § 10 explains the restore.
 *
 * A restore writes rows by primary key and never deletes: content added since
 * the backup stays. Tables and modes are in src/lib/backup/tables.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));

type Supabase = import("@supabase/supabase-js").SupabaseClient;

function passphrase(isBackupPassphrase: (v: unknown) => v is string): string {
  const value = process.env.BACKUP_PASSPHRASE;
  if (!isBackupPassphrase(value)) {
    throw new Error("Set BACKUP_PASSPHRASE (16+ characters, e.g. from `openssl rand -hex 32`) in .env.local or the GitHub secrets (SETUP.md § 10).");
  }
  return value.trim();
}

async function fetchAll(supabase: Supabase, table: string, primaryKey: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select("*").order(primaryKey, { ascending: true }).range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < page) return rows;
  }
}

async function backup() {
  const [{ createAdminClient }, { supabaseUrl }, { backupFileName, encryptBackup, isBackupPassphrase }, { BACKUP_TABLES, buildBackupFile, summarize }] =
    await Promise.all([import("@/lib/supabase/admin"), import("@/lib/supabase/env"), import("@/lib/backup/crypto"), import("@/lib/backup/tables")]);
  const secret = passphrase(isBackupPassphrase);
  const supabase = createAdminClient();
  const now = new Date();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of BACKUP_TABLES) tables[t.table] = await fetchAll(supabase, t.table, t.primaryKey);
  const file = buildBackupFile(tables, new URL(supabaseUrl() ?? "http://unknown").host, now);
  const out = resolve(process.cwd(), typeof args.out === "string" ? args.out : `backups/${backupFileName(now)}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encryptBackup(JSON.stringify(file), secret));
  console.log(summarize(file).join("\n"));
  console.log(`\nEncrypted backup written: ${out}`);
}

async function decrypt(path: string) {
  const [{ decryptBackup, isBackupPassphrase }, { parseBackupFile, summarize }] = await Promise.all([import("@/lib/backup/crypto"), import("@/lib/backup/tables")]);
  const secret = passphrase(isBackupPassphrase);
  const json = decryptBackup(readFileSync(resolve(process.cwd(), path)), secret);
  const file = parseBackupFile(JSON.parse(json));
  const out = resolve(process.cwd(), typeof args.out === "string" ? args.out : path.replace(/\.enc$/, "") + (path.endsWith(".enc") ? "" : ".json"));
  if (existsSync(out) && args.force !== true) throw new Error(`${out} exists; pass --out <file> or --force.`);
  writeFileSync(out, json);
  console.log(`Backup of ${file.source} taken ${file.createdAt}:\n${summarize(file).join("\n")}\n\nDecrypted copy: ${out} (it holds the battle-plan password — delete it when done).`);
}

async function restore(path: string) {
  const [{ createAdminClient }, { supabaseUrl }, { decryptBackup, isBackupPassphrase }, tablesModule] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/supabase/env"),
    import("@/lib/backup/crypto"),
    import("@/lib/backup/tables"),
  ]);
  const { BACKUP_TABLES, chunk, grantsFromBackup, grantsFromProfiles, missingGrants, parseBackupFile, restoreOrder, summarize, withoutColumns } = tablesModule;
  const secret = passphrase(isBackupPassphrase);
  const file = parseBackupFile(JSON.parse(decryptBackup(readFileSync(resolve(process.cwd(), path)), secret)));
  const target = new URL(supabaseUrl() ?? "http://unknown").host;
  console.log(`Backup of ${file.source} taken ${file.createdAt}; target project: ${target}${file.source !== target ? " (a different project)" : ""}`);
  console.log(summarize(file).join("\n"));
  if (args.yes !== true) {
    console.log("\nNothing written. Add --yes to restore (rows are written by primary key, nothing is deleted); --tables a,b restores a subset.");
    return;
  }

  const selected = typeof args.tables === "string" ? restoreOrder(args.tables.split(",")) : [...BACKUP_TABLES];
  const supabase = createAdminClient();
  let profilesRestored = false;
  console.log("");
  for (const t of selected) {
    const rows = file.tables[t.table] ?? [];
    if (rows.length === 0) {
      console.log(`${t.table}: nothing in the backup`);
      continue;
    }
    if (t.restore === "upsert") {
      let written = 0;
      let failed: string | null = null;
      for (const part of chunk(rows, 500)) {
        const { error } = await supabase.from(t.table).upsert(part, { onConflict: t.primaryKey });
        if (error) {
          failed = error.message;
          break;
        }
        written += part.length;
      }
      if (failed && t.table === "profiles") {
        console.log(`profiles: not restored (${failed}); accounts are created at sign-in, roles come back through role_grants`);
      } else if (failed) {
        throw new Error(`${t.table}: ${failed} (after ${written} rows)`);
      } else {
        if (t.table === "profiles") profilesRestored = true;
        console.log(`${t.table}: ${written} rows written`);
      }
    } else if (t.restore === "insert-missing") {
      const { data: existing, error } = await supabase.from(t.table).select("discord_username, email");
      if (error) throw new Error(`${t.table}: ${error.message}`);
      const wanted = [...grantsFromBackup(rows), ...grantsFromProfiles(file.tables.profiles ?? [])];
      const toInsert = missingGrants(wanted, (existing ?? []) as Record<string, unknown>[]);
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from(t.table).insert(toInsert);
        if (insertError) throw new Error(`${t.table}: ${insertError.message}`);
      }
      console.log(`${t.table}: ${toInsert.length} grants added (${wanted.length - toInsert.length} already present)`);
    } else {
      const { count, error } = await supabase.from(t.table).select("*", { count: "exact", head: true });
      if (error) throw new Error(`${t.table}: ${error.message}`);
      if ((count ?? 0) > 0) {
        console.log(`${t.table}: left alone (${count} rows present; the history is appended only into an empty table)`);
        continue;
      }
      const dropped = profilesRestored ? ["id"] : ["id", "actor_id"];
      for (const part of chunk(withoutColumns(rows, dropped), 500)) {
        const { error: insertError } = await supabase.from(t.table).insert(part);
        if (insertError) throw new Error(`${t.table}: ${insertError.message}`);
      }
      console.log(`${t.table}: ${rows.length} rows appended${profilesRestored ? "" : " (without actor ids)"}`);
    }
  }
  console.log("\nDone. Run `npm run translate` for anything the backup lacks, then refresh the cache (SETUP.md).");
}

async function main() {
  if (typeof args.decrypt === "string") return decrypt(args.decrypt);
  if (typeof args.restore === "string") return restore(args.restore);
  if (args.decrypt === true || args.restore === true) throw new Error("--decrypt and --restore need a file path.");
  return backup();
}

main().catch((error) => {
  console.error("Backup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
