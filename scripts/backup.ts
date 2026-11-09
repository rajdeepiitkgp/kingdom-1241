/**
 * Encrypted backup of the site's content and admin tables and of the content
 * images, and its restore.
 *
 *   npm run backup                                   # → backups/kingdom-1241-<time>.json.enc and .images.enc
 *   npm run backup -- --out <file>                   # same, chosen path (the images file goes next to it)
 *   npm run backup -- --decrypt <file> [--out <json>]   # readable copy of the table dump (keep it private)
 *   npm run backup -- --unpack <images.enc> [--out <dir>]   # the image files into a folder
 *   npm run backup -- --restore <file>               # show what the files hold
 *   npm run backup -- --restore <file> --yes [--tables guides,rules] [--images <file> | --no-images]   # write it back
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and BACKUP_PASSPHRASE
 * (16+ characters; the Maintenance workflow reads it from the GitHub secret).
 * The Maintenance workflow runs the backup every Monday and keeps both files as
 * one artifact for 90 days; SETUP.md § 10 explains the restore.
 *
 * The table dump is written first, so a problem with the images (the bucket,
 * a download) never loses it: the script then fails after the dump is on disk
 * and the workflow still uploads it. The images are read from the bucket
 * itself, all of them in memory at once (at most the 500 MB image budget).
 *
 * A restore writes rows by primary key and never deletes: content added since
 * the backup stays. Tables and modes are in src/lib/backup/tables.ts; the
 * images file of the same run is found next to the dump by its name, and the
 * restore uploads only the files the bucket lacks, never over an existing one.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));

type Supabase = import("@supabase/supabase-js").SupabaseClient;
type ImageFile = import("@/lib/backup/images").ImageFile;

/** Where the content images live in the bucket (`content/<uuid>-<w>x<h>.<ext>`). */
const IMAGE_FOLDER = "content";
const DOWNLOADS_AT_ONCE = 5;

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

/** Every file path in the images bucket's content folder (folders and other names left out). */
async function listImagePaths(supabase: Supabase, bucket: string, isImagePath: (path: string) => boolean): Promise<string[]> {
  const paths: string[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await supabase.storage.from(bucket).list(IMAGE_FOLDER, { limit: page, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`images: could not list the bucket: ${error.message}`);
    for (const item of data ?? []) {
      const path = `${IMAGE_FOLDER}/${item.name}`;
      if (item.id && isImagePath(path)) paths.push(path);
    }
    if (!data || data.length < page) return paths;
  }
}

async function downloadImages(supabase: Supabase, bucket: string, paths: readonly string[]): Promise<ImageFile[]> {
  const files: ImageFile[] = [];
  for (let i = 0; i < paths.length; i += DOWNLOADS_AT_ONCE) {
    const batch = await Promise.all(
      paths.slice(i, i + DOWNLOADS_AT_ONCE).map(async (path) => {
        const { data, error } = await supabase.storage.from(bucket).download(path);
        if (error || !data) throw new Error(`images: could not download ${path}: ${error?.message ?? "no data"}`);
        return { path, data: Buffer.from(await data.arrayBuffer()) };
      }),
    );
    files.push(...batch);
  }
  return files;
}

async function backup() {
  const [{ createAdminClient }, { supabaseUrl }, { backupFileName, encryptBackup, encryptBytes, imageBackupFileName, imagesFileFor, isBackupPassphrase }, { BACKUP_TABLES, buildBackupFile, summarize }, { isImagePath, packImages, summarizeImages }, { IMAGE_BUCKET }, { writeConfig }] =
    await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/lib/supabase/env"),
      import("@/lib/backup/crypto"),
      import("@/lib/backup/tables"),
      import("@/lib/backup/images"),
      import("@/lib/content/images"),
      import("@/lib/config/app-config"),
    ]);
  const secret = passphrase(isBackupPassphrase);
  const supabase = createAdminClient();
  const now = new Date();
  const source = new URL(supabaseUrl() ?? "http://unknown").host;

  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of BACKUP_TABLES) tables[t.table] = await fetchAll(supabase, t.table, t.primaryKey);
  const file = buildBackupFile(tables, source, now);
  const out = resolve(process.cwd(), typeof args.out === "string" ? args.out : `backups/${backupFileName(now)}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, encryptBackup(JSON.stringify(file), secret));
  console.log(summarize(file).join("\n"));
  console.log(`\nEncrypted backup written: ${out}`);

  // The images, after the dump is safe on disk.
  const images = await downloadImages(supabase, IMAGE_BUCKET, await listImagePaths(supabase, IMAGE_BUCKET, isImagePath));
  const imagesOut = typeof args.out === "string" ? (imagesFileFor(out) ?? `${out}.images.enc`) : resolve(process.cwd(), `backups/${imageBackupFileName(now)}`);
  writeFileSync(imagesOut, encryptBytes(packImages(images, source, now), secret));
  const imageBytes = images.reduce((sum, image) => sum + image.data.length, 0);
  console.log(`images: ${summarizeImages(images.map((image) => ({ path: image.path, bytes: image.data.length })))}`);
  console.log(`Encrypted images written: ${imagesOut}`);

  // When the last backup ran, for the owner's Usage tab; never fails the backup.
  const rows = Object.values(tables).reduce((n, list) => n + list.length, 0);
  try {
    await writeConfig(supabase, "last_backup", { at: now.toISOString(), tables: BACKUP_TABLES.length, rows, images: images.length, imageBytes });
  } catch (error) {
    console.warn(`Could not note the backup for the Usage tab: ${error instanceof Error ? error.message : String(error)}`);
  }
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

async function unpack(path: string) {
  const [{ decryptBytes, isBackupPassphrase }, { summarizeImages, unpackImages }] = await Promise.all([import("@/lib/backup/crypto"), import("@/lib/backup/images")]);
  const secret = passphrase(isBackupPassphrase);
  const archive = unpackImages(decryptBytes(readFileSync(resolve(process.cwd(), path)), secret));
  const out = resolve(process.cwd(), typeof args.out === "string" ? args.out : path.replace(/\.enc$/, ""));
  if (existsSync(out) && args.force !== true) throw new Error(`${out} exists; pass --out <folder> or --force.`);
  for (const file of archive.files) {
    const target = join(out, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.data);
  }
  console.log(`Images of ${archive.manifest.source} taken ${archive.manifest.createdAt}: ${summarizeImages(archive.manifest.files)}\n\nUnpacked into: ${out}`);
}

async function restore(path: string) {
  const [{ createAdminClient }, { supabaseUrl }, { decryptBackup, decryptBytes, imagesFileFor, isBackupPassphrase }, tablesModule, imagesModule, { IMAGE_BUCKET }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/supabase/env"),
    import("@/lib/backup/crypto"),
    import("@/lib/backup/tables"),
    import("@/lib/backup/images"),
    import("@/lib/content/images"),
  ]);
  const { BACKUP_TABLES, chunk, grantsFromBackup, grantsFromProfiles, missingGrants, parseBackupFile, restoreOrder, restoreRows, summarize, withoutColumns } = tablesModule;
  const { imageContentType, isImagePath, missingImages, summarizeImages, unpackImages } = imagesModule;
  const secret = passphrase(isBackupPassphrase);
  const tablesPath = resolve(process.cwd(), path);
  const file = parseBackupFile(JSON.parse(decryptBackup(readFileSync(tablesPath), secret)));
  const target = new URL(supabaseUrl() ?? "http://unknown").host;
  console.log(`Backup of ${file.source} taken ${file.createdAt}; target project: ${target}${file.source !== target ? " (a different project)" : ""}`);
  console.log(summarize(file).join("\n"));

  // The images of the same run sit next to the dump; --images points elsewhere, --no-images leaves them out.
  const sibling = imagesFileFor(tablesPath);
  const imagesPath = args["no-images"] === true ? null : typeof args.images === "string" ? resolve(process.cwd(), args.images) : sibling && existsSync(sibling) ? sibling : null;
  const archive = imagesPath ? unpackImages(decryptBytes(readFileSync(imagesPath), secret)) : null;
  console.log(archive ? `images: ${summarizeImages(archive.manifest.files)} (${imagesPath})` : `images: none${args["no-images"] === true ? " (--no-images)" : " (no .images.enc next to the dump; --images <file> names one)"}`);

  if (args.yes !== true) {
    console.log("\nNothing written. Add --yes to restore (rows are written by primary key, nothing is deleted; images only where the bucket lacks the file); --tables a,b restores a subset.");
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
      for (const part of chunk(restoreRows(t, rows), 500)) {
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
        console.log(`${t.table}: ${written} rows written${t.restoreWith ? `, each with ${JSON.stringify(t.restoreWith)} (one battle plan may be active: activate the right one in the admin)` : ""}`);
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

  if (archive) {
    const present = new Set(await listImagePaths(supabase, IMAGE_BUCKET, isImagePath));
    const missing = missingImages(archive.files, present);
    for (const image of missing) {
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(image.path, image.data, { contentType: imageContentType(image.path), cacheControl: "31536000", upsert: false });
      if (error) throw new Error(`images: could not upload ${image.path}: ${error.message}`);
    }
    console.log(`images: ${missing.length} file(s) uploaded (${archive.files.length - missing.length} already in the bucket)`);
  }
  console.log("\nDone. Run `npm run translate` for anything the backup lacks, then refresh the cache (SETUP.md).");
}

async function main() {
  if (typeof args.decrypt === "string") return decrypt(args.decrypt);
  if (typeof args.unpack === "string") return unpack(args.unpack);
  if (typeof args.restore === "string") return restore(args.restore);
  if (args.decrypt === true || args.unpack === true || args.restore === true) throw new Error("--decrypt, --unpack and --restore need a file path.");
  return backup();
}

main().catch((error) => {
  console.error("Backup failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
