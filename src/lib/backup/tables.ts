/**
 * What the content backup contains and how it goes back in (scripts/backup.ts).
 *
 * Tables are listed in dependency order so a restore into an empty project
 * satisfies every foreign key: topics before rules, heroes and plans before
 * formations, retrospectives before their responses, profiles before the
 * grants and the log that point at them. The feedback responses are small
 * (a few hundred rows of at most 1.5 KB each per battle) and are pruned after
 * the retention period, so the weekly file stays well under a megabyte.
 *
 * Restore modes:
 *   upsert           rows are written by primary key; rows added since the
 *                    backup stay (a restore never deletes).
 *   insert-missing   role_grants: a grant per Discord handle or e-mail exists
 *                    once; only the ones not present are added. A fresh project
 *                    has no accounts (profiles reference auth.users), so the
 *                    admins and moderators of the backup are turned into grants
 *                    as well and get their role back on their first sign-in.
 *   append-if-empty  audit_log has a generated id; its history is appended
 *                    once, into an empty table, without the old ids.
 */
export type RestoreMode = "upsert" | "insert-missing" | "append-if-empty";

export interface BackupTable {
  table: string;
  primaryKey: string;
  restore: RestoreMode;
}

export const BACKUP_TABLES: readonly BackupTable[] = [
  { table: "languages", primaryKey: "code", restore: "upsert" },
  { table: "site_settings", primaryKey: "key", restore: "upsert" },
  { table: "ui_strings", primaryKey: "key", restore: "upsert" },
  { table: "announcements", primaryKey: "id", restore: "upsert" },
  { table: "events", primaryKey: "id", restore: "upsert" },
  { table: "rule_topics", primaryKey: "id", restore: "upsert" },
  { table: "rules", primaryKey: "id", restore: "upsert" },
  { table: "guides", primaryKey: "id", restore: "upsert" },
  { table: "alliances", primaryKey: "id", restore: "upsert" },
  { table: "gift_codes", primaryKey: "id", restore: "upsert" },
  { table: "heroes", primaryKey: "id", restore: "upsert" },
  { table: "kvk_plans", primaryKey: "id", restore: "upsert" },
  { table: "kvk_rules", primaryKey: "id", restore: "upsert" },
  { table: "kvk_coordinators", primaryKey: "id", restore: "upsert" },
  { table: "kvk_formations", primaryKey: "id", restore: "upsert" },
  { table: "kvk_leader_briefs", primaryKey: "id", restore: "upsert" },
  { table: "kvk_leader_rules", primaryKey: "id", restore: "upsert" },
  { table: "kvk_rally_leaders", primaryKey: "id", restore: "upsert" },
  { table: "kvk_checklist_briefs", primaryKey: "id", restore: "upsert" },
  { table: "kvk_checklist_items", primaryKey: "id", restore: "upsert" },
  { table: "kvk_checklist_rules", primaryKey: "id", restore: "upsert" },
  { table: "kvk_retrospectives", primaryKey: "id", restore: "upsert" },
  { table: "kvk_retro_responses", primaryKey: "id", restore: "upsert" },
  { table: "profiles", primaryKey: "id", restore: "upsert" },
  { table: "role_grants", primaryKey: "id", restore: "insert-missing" },
  { table: "audit_log", primaryKey: "id", restore: "append-if-empty" },
];

/** Tables that exist but hold nothing worth keeping (a test checks every other table is listed above). */
export const NOT_BACKED_UP: readonly string[] = [
  "kvk_unlock_throttle", // wrong-password counters, pruned after two days
];

export type Row = Record<string, unknown>;

export const BACKUP_FORMAT = "kingdom-1241-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  /** When the dump was taken (ISO 8601, UTC). */
  createdAt: string;
  /** Host of the Supabase project it came from, so a restore into another project is a conscious act. */
  source: string;
  tables: Record<string, Row[]>;
}

export function buildBackupFile(tables: Record<string, Row[]>, source: string, now: Date): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: now.toISOString(), source, tables };
}

/** Validates the shape of a decrypted backup; throws a readable error otherwise. */
export function parseBackupFile(value: unknown): BackupFile {
  if (typeof value !== "object" || value === null) throw new Error("The backup is not a JSON object.");
  const v = value as Record<string, unknown>;
  if (v.format !== BACKUP_FORMAT) throw new Error("The file is not a Kingdom 1241 backup.");
  if (v.version !== BACKUP_VERSION) throw new Error(`Backup version ${String(v.version)} is not supported (expected ${BACKUP_VERSION}).`);
  if (typeof v.createdAt !== "string" || Number.isNaN(Date.parse(v.createdAt))) throw new Error("The backup has no valid createdAt.");
  if (typeof v.source !== "string") throw new Error("The backup has no source.");
  if (typeof v.tables !== "object" || v.tables === null) throw new Error("The backup has no tables.");
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(v.tables as Record<string, unknown>)) {
    if (!Array.isArray(rows) || rows.some((r) => typeof r !== "object" || r === null)) throw new Error(`Table ${name} is not a list of rows.`);
    tables[name] = rows as Row[];
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: v.createdAt, source: v.source, tables };
}

/** One line per table: "guides: 5 rows". Tables in the file but unknown to this code are flagged. */
export function summarize(backup: BackupFile): string[] {
  const known = new Set(BACKUP_TABLES.map((t) => t.table));
  const lines = BACKUP_TABLES.map((t) => `${t.table}: ${(backup.tables[t.table] ?? []).length} rows`);
  for (const name of Object.keys(backup.tables)) if (!known.has(name)) lines.push(`${name}: ${backup.tables[name].length} rows (unknown table, not restored)`);
  return lines;
}

/** The requested tables in restore order; unknown names are an error, not a silent skip. */
export function restoreOrder(requested: readonly string[]): BackupTable[] {
  const wanted = new Set(requested.map((t) => t.trim()).filter(Boolean));
  const known = new Set(BACKUP_TABLES.map((t) => t.table));
  const unknown = [...wanted].filter((t) => !known.has(t));
  if (unknown.length > 0) throw new Error(`Unknown table(s): ${unknown.join(", ")}. Known: ${[...known].join(", ")}.`);
  return BACKUP_TABLES.filter((t) => wanted.has(t.table));
}

export function chunk<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export function withoutColumns(rows: readonly Row[], columns: readonly string[]): Row[] {
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !columns.includes(key))));
}

export interface GrantRow {
  role: "admin" | "moderator";
  discord_username: string | null;
  email: string | null;
  note: string;
}

function lower(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim().toLowerCase() : null;
}

/** Pre-authorisations that give the backed-up admins and moderators their role back on their next sign-in. */
export function grantsFromProfiles(profiles: readonly Row[]): GrantRow[] {
  const out: GrantRow[] = [];
  for (const p of profiles) {
    if (p.role !== "admin" && p.role !== "moderator") continue;
    const discord_username = lower(p.discord_username);
    const email = discord_username ? null : lower(p.email);
    if (!discord_username && !email) continue;
    out.push({ role: p.role, discord_username, email, note: "restored from backup" });
  }
  return out;
}

/** Grants from the backup (first) and from profiles that are not already present, one per handle or e-mail. */
export function missingGrants(wanted: readonly GrantRow[], existing: readonly Row[]): GrantRow[] {
  const seen = new Set<string>();
  for (const row of existing) {
    const handle = lower(row.discord_username);
    const email = lower(row.email);
    if (handle) seen.add(`d:${handle}`);
    if (email) seen.add(`e:${email}`);
  }
  const out: GrantRow[] = [];
  for (const grant of wanted) {
    const key = grant.discord_username ? `d:${grant.discord_username}` : grant.email ? `e:${grant.email}` : null;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(grant);
  }
  return out;
}

/** Rows of the backup's role_grants as GrantRows (ids and authors are left behind: they belong to the old project). */
export function grantsFromBackup(rows: readonly Row[]): GrantRow[] {
  const out: GrantRow[] = [];
  for (const r of rows) {
    if (r.role !== "admin" && r.role !== "moderator") continue;
    const discord_username = lower(r.discord_username);
    const email = lower(r.email);
    if (!discord_username && !email) continue;
    out.push({ role: r.role, discord_username, email, note: typeof r.note === "string" ? r.note : "" });
  }
  return out;
}
