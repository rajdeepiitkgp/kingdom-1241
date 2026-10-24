import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  buildBackupFile,
  chunk,
  grantsFromBackup,
  grantsFromProfiles,
  missingGrants,
  NOT_BACKED_UP,
  parseBackupFile,
  restoreOrder,
  summarize,
  withoutColumns,
} from "@/lib/backup/tables";
import { TRANSLATABLE_TABLES } from "@/lib/translate/tables";

/** Every table the migrations create in the public schema. */
function migratedTables(): string[] {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const names = new Set<string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(resolve(dir, file), "utf8");
    for (const m of sql.matchAll(/create table if not exists public\.([a-z_]+)/g)) names.add(m[1]);
  }
  return [...names];
}

describe("backup tables", () => {
  it("cover every table the migrations create, or name it as deliberately left out", () => {
    const listed = new Set([...BACKUP_TABLES.map((t) => t.table), ...NOT_BACKED_UP]);
    for (const table of migratedTables()) expect(listed, `${table} is neither backed up nor listed in NOT_BACKED_UP`).toContain(table);
    for (const table of NOT_BACKED_UP) expect(BACKUP_TABLES.map((t) => t.table)).not.toContain(table);
  });

  it("include every translatable table", () => {
    const backed = BACKUP_TABLES.map((t) => t.table);
    for (const { table } of TRANSLATABLE_TABLES) expect(backed, table).toContain(table);
  });

  it("are ordered so a restore satisfies the foreign keys", () => {
    const index = (table: string) => BACKUP_TABLES.findIndex((t) => t.table === table);
    expect(index("rule_topics")).toBeLessThan(index("rules"));
    expect(index("heroes")).toBeLessThan(index("kvk_formations"));
    expect(index("kvk_plans")).toBeLessThan(index("kvk_rules"));
    expect(index("kvk_plans")).toBeLessThan(index("kvk_coordinators"));
    expect(index("kvk_plans")).toBeLessThan(index("kvk_formations"));
    expect(index("kvk_plans")).toBeLessThan(index("kvk_retrospectives"));
    expect(index("kvk_retrospectives")).toBeLessThan(index("kvk_retro_responses"));
    expect(index("profiles")).toBeLessThan(index("role_grants"));
    expect(index("profiles")).toBeLessThan(index("audit_log"));
    expect(new Set(BACKUP_TABLES.map((t) => t.table)).size).toBe(BACKUP_TABLES.length);
  });

  it("restore the log by appending and the grants by filling gaps", () => {
    expect(BACKUP_TABLES.find((t) => t.table === "audit_log")?.restore).toBe("append-if-empty");
    expect(BACKUP_TABLES.find((t) => t.table === "role_grants")?.restore).toBe("insert-missing");
    expect(BACKUP_TABLES.filter((t) => t.restore === "upsert").length).toBe(BACKUP_TABLES.length - 2);
  });
});

describe("backup file", () => {
  const now = new Date("2026-10-24T18:45:00Z");

  it("builds, summarises and parses", () => {
    const file = buildBackupFile({ guides: [{ id: "a" }, { id: "b" }], extra: [{ x: 1 }] }, "abc.supabase.co", now);
    expect(file.createdAt).toBe("2026-10-24T18:45:00.000Z");
    const parsed = parseBackupFile(JSON.parse(JSON.stringify(file)));
    expect(parsed).toEqual(file);
    const lines = summarize(parsed);
    expect(lines).toContain("guides: 2 rows");
    expect(lines).toContain("rules: 0 rows");
    expect(lines.at(-1)).toMatch(/^extra: 1 rows \(unknown table/);
  });

  it("rejects files that are not backups", () => {
    expect(() => parseBackupFile(null)).toThrow(/not a JSON object/);
    expect(() => parseBackupFile({ format: "other" })).toThrow(/not a Kingdom 1241 backup/);
    expect(() => parseBackupFile({ format: "kingdom-1241-backup", version: 2 })).toThrow(/version 2/);
    expect(() => parseBackupFile({ format: "kingdom-1241-backup", version: 1, createdAt: "yesterday", source: "x", tables: {} })).toThrow(/createdAt/);
    expect(() => parseBackupFile({ format: "kingdom-1241-backup", version: 1, createdAt: now.toISOString(), source: "x", tables: { rules: "no" } })).toThrow(/rules/);
  });

  it("orders a requested subset and refuses unknown names", () => {
    expect(restoreOrder(["rules", " rule_topics", "guides"]).map((t) => t.table)).toEqual(["rule_topics", "rules", "guides"]);
    expect(() => restoreOrder(["rules", "nope"])).toThrow(/Unknown table\(s\): nope/);
  });

  it("chunks and strips columns", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
    expect(withoutColumns([{ id: 1, actor_id: "a", action: "x" }], ["id", "actor_id"])).toEqual([{ action: "x" }]);
  });
});

describe("role grants on restore", () => {
  it("turn the backed-up admins and moderators into pre-authorisations, members not", () => {
    const grants = grantsFromProfiles([
      { role: "admin", discord_username: "Alice", email: "alice@example.com" },
      { role: "moderator", discord_username: null, email: "Bob@Example.com" },
      { role: "member", discord_username: "carol" },
      { role: "admin", discord_username: "", email: "" },
    ]);
    expect(grants).toEqual([
      { role: "admin", discord_username: "alice", email: null, note: "restored from backup" },
      { role: "moderator", discord_username: null, email: "bob@example.com", note: "restored from backup" },
    ]);
  });

  it("keep one grant per handle or e-mail and skip the ones already present", () => {
    const wanted = [
      ...grantsFromBackup([
        { role: "moderator", discord_username: "dave", email: null, note: "council", id: "old", created_by: "gone" },
        { role: "viewer", discord_username: "eve" },
      ]),
      ...grantsFromProfiles([{ role: "admin", discord_username: "alice" }, { role: "moderator", discord_username: "dave" }]),
    ];
    expect(wanted.map((g) => g.discord_username)).toEqual(["dave", "alice", "dave"]);
    const missing = missingGrants(wanted, [{ discord_username: "ALICE", email: null }]);
    expect(missing).toEqual([{ role: "moderator", discord_username: "dave", email: null, note: "council" }]);
    expect(missing[0]).not.toHaveProperty("id");
  });
});
