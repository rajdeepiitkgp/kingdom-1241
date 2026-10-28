// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Read-only export for the `/translation-review` skill: admin-written content
 * in the machine-translated languages (the active battle plan with its leader,
 * checklist and feedback pages, and the public content), with automatic
 * findings and the languages a moderator corrected by hand.
 *
 *   npm run content:review -- --out <dir>                    # writes <dir>/content-review.json
 *   npm run content:review -- --out <dir> --table kvk_rules  # some tables only (comma list)
 *   npm run content:review -- --out <dir> --all              # also hints on texts reviewed before
 *   npm run content:review -- --mark-reviewed [--table …]    # records today's texts as reviewed
 *
 * Reads with the service key (the battle-plan tables have no public read
 * policy), selects only ids and translatable columns (never a password) and
 * writes nothing to the database. Battle-plan texts are secret and the
 * repository is public: the export goes to <dir> (a temporary folder) and the
 * state file holds only hashes and is git-ignored. Fixes are applied by the
 * owner with `npm run content:fixes`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const STATE_FILE = resolve(process.cwd(), ".claude/skills/translation-review/content-state.local.json");

async function main() {
  const [{ createAdminClient }, { TRANSLATABLE_TABLES, isTranslatableRow }, { getEnabledLocalesForTranslation }, { GLOSSARY }, review] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/translate/tables"),
    import("@/lib/translate/translate-row"),
    import("@/lib/translate/glossary"),
    import("@/lib/i18n/content-review"),
  ]);
  type Cell = import("@/lib/i18n/content-review").ContentCell;

  const supabase = createAdminClient();
  const locales = await getEnabledLocalesForTranslation(supabase);
  const { data: plans, error: planError } = await supabase.from("kvk_plans").select("id").eq("active", true);
  if (planError) throw new Error(`kvk_plans: ${planError.message}`);
  const planIds = (plans ?? []).map((p) => String(p.id));

  const only = typeof args.table === "string" ? args.table.split(",").map((t) => t.trim()) : null;
  const tables = TRANSLATABLE_TABLES.filter((t) => t.table !== "ui_strings" && (!only || only.includes(t.table)));
  const cells: Cell[] = [];
  for (const config of tables) {
    const isPlanTable = config.table.startsWith("kvk_");
    if (isPlanTable && planIds.length === 0) continue;
    const columns = [config.primaryKey, ...config.columns.map((c) => c.name)];
    let query = supabase.from(config.table).select(columns.join(", "));
    if (config.table === "kvk_plans") query = query.in("id", planIds);
    else if (isPlanTable) query = query.in("plan_id", planIds);
    const { data, error } = await query;
    if (error) throw new Error(`${config.table}: ${error.message}`);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      if (!isTranslatableRow(config.table, row)) continue;
      for (const column of config.columns) {
        const value = row[column.name];
        if (!value || typeof value !== "object") continue;
        cells.push({ table: config.table, id: String(row[config.primaryKey]), column: column.name, html: column.html, value: value as Record<string, string>, manual: {} });
      }
    }
  }

  // Languages a moderator corrected by hand (oldest first, so the newest wins).
  const ids = [...new Set(cells.filter((c) => c.table.startsWith("kvk_")).map((c) => c.id))];
  if (ids.length > 0) {
    const { data: audits, error } = await supabase
      .from("audit_log")
      .select("table_name, row_id, details, actor_name, created_at")
      .eq("action", "translation.update")
      .in("row_id", ids)
      .order("created_at");
    if (error) throw new Error(`audit_log: ${error.message}`);
    const byCell = new Map(cells.map((c) => [review.cellKey(c), c]));
    for (const entry of audits ?? []) {
      const details = (entry.details ?? {}) as { column?: string; lang?: string };
      const cell = byCell.get(`${entry.table_name}:${entry.row_id}:${details.column}`);
      if (cell && details.lang) cell.manual[details.lang] = { at: String(entry.created_at), by: String(entry.actor_name ?? "") };
    }
  }

  let state: Record<string, string> = {};
  try {
    state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Record<string, string>;
  } catch {
    // First run: everything counts as changed.
  }

  if (args["mark-reviewed"] === true) {
    const inScope = new Set(tables.map((t) => t.table));
    for (const key of Object.keys(state)) if (inScope.has(key.split(":")[0])) delete state[key];
    for (const cell of cells) state[review.cellKey(cell)] = review.cellHash(cell, locales);
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 1)}\n`);
    console.log(`Recorded ${cells.length} text(s) as reviewed in ${STATE_FILE} (git-ignored).`);
    return;
  }

  if (typeof args.out !== "string") throw new Error("Pass --out <dir> (or --mark-reviewed).");
  const items = review.reviewContent(cells, locales, GLOSSARY, state, { all: args.all === true });
  const glossary = Object.fromEntries(
    locales.map((l) => [l, GLOSSARY.map((e) => ({ term: e.term, use: e.keep ? e.term : (e.translations?.[l] ?? null), note: e.note ?? null }))]),
  );
  const out = resolve(args.out);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "content-review.json"), JSON.stringify({ generatedAt: new Date().toISOString(), locales, activePlans: planIds, glossary, items }, null, 1));

  // Counts only: the texts stay in the file.
  console.log(`Languages: ${locales.join(", ")}; active plan(s): ${planIds.length}`);
  console.log(`${cells.length} text(s) read, ${items.length} to look at (${items.filter((i) => i.changed).length} new or changed since the last review).`);
  const byTable = new Map<string, number>();
  for (const item of items) byTable.set(item.table, (byTable.get(item.table) ?? 0) + 1);
  for (const [table, n] of byTable) console.log(`  ${table}: ${n}`);
  const manual = cells.reduce((n, c) => n + Object.keys(c.manual).length, 0);
  if (manual > 0) console.log(`${manual} language(s) corrected by hand: marked in the file and left alone.`);
  console.log(`Wrote ${join(out, "content-review.json")} (battle-plan texts are secret: keep the file out of the repository).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
