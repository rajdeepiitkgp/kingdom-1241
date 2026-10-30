// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Applies reviewed translation fixes of admin-written content, written by
 * the `/translation-review` skill into a JSON file outside the repository
 * (battle-plan texts are secret). Run by the owner:
 *
 *   npm run content:fixes -- --file <fixes.json>           # shows what would change (nothing is written)
 *   npm run content:fixes -- --file <fixes.json> --apply   # writes the fixes
 *
 * The file is `{ "fixes": [{ table, id, column, lang, en, from, to }] }`.
 * Each fix replaces one language of one text, only while the English is still
 * `en` and the translation still `from`, so a moderator's newer correction or
 * a fresh machine translation is never overwritten. Like a moderator's
 * correction it leaves `source_hash` alone (the pipeline keeps it), and every
 * write is an audit entry `translation.review`. Prints table, id, column and
 * language, never the texts.
 */
import { readFileSync } from "node:fs";
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));

/** Tables whose intro also keeps an editable Markdown source per language (see saveTranslation). */
const INTRO_SOURCE_TABLES = new Set(["kvk_plans", "kvk_retrospectives", "kvk_leader_briefs", "kvk_checklist_briefs"]);

async function main() {
  if (typeof args.file !== "string") throw new Error("Pass --file <fixes.json> (add --apply to write).");
  const apply = args.apply === true;
  const [{ createAdminClient }, { getTranslatableTable, isHtmlField }, { pendingColumns, withLanguage }, { sanitizeRichText }, review] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/translate/tables"),
    import("@/lib/admin/translation"),
    import("@/lib/html"),
    import("@/lib/i18n/content-review"),
  ]);
  type Fix = import("@/lib/i18n/content-review").ContentFix;

  const parsed = JSON.parse(readFileSync(args.file, "utf8")) as { fixes?: Partial<Fix>[] } | Partial<Fix>[];
  const fixes = Array.isArray(parsed) ? parsed : (parsed.fixes ?? []);
  const supabase = createAdminClient();
  const counts = new Map<string, number>();
  const count = (outcome: string) => counts.set(outcome, (counts.get(outcome) ?? 0) + 1);

  for (const fix of fixes) {
    const config = fix.table ? getTranslatableTable(fix.table) : null;
    const column = config?.columns.find((c) => c.name === fix.column) ?? null;
    const label = `${fix.table} ${fix.id} ${fix.column} ${fix.lang}`;
    // The site settings hold HTML under some keys (the transfer texts): the column alone doesn't say so.
    const html = config && column ? isHtmlField(config.table, String(fix.id ?? ""), column) : false;
    const problems = review.fixProblems(fix, config && column && config.table !== "ui_strings" ? { ...column, html } : null);
    if (problems.length > 0 || !config || !column) {
      console.log(`invalid   ${label}: ${problems.join("; ")}`);
      count("invalid");
      continue;
    }
    const valid = fix as Fix;
    const select = [config.primaryKey, ...config.columns.map((c) => c.name), "source_hash", ...(column.name === "intro" && INTRO_SOURCE_TABLES.has(config.table) ? ["intro_source"] : [])];
    const { data: row, error } = await supabase.from(config.table).select(select.join(", ")).eq(config.primaryKey, valid.id).maybeSingle();
    if (error) throw new Error(`${config.table}: ${error.message}`);
    const current = row as unknown as Record<string, unknown> | null;
    if (!current) {
      console.log(`skipped   ${label}: the row no longer exists`);
      count("skipped");
      continue;
    }
    if (pendingColumns(config.table, current).includes(column.name)) {
      console.log(`skipped   ${label}: its machine translation is still running, try again later`);
      count("skipped");
      continue;
    }
    const to = html ? sanitizeRichText(valid.to) : valid.to;
    const value = (current[column.name] ?? {}) as Record<string, string>;
    const decision = review.fixDecision(value, { ...valid, to });
    if (decision !== "apply") {
      const why = { already: "already applied", "english-changed": "the English changed since the review", "text-changed": "the translation changed since the review (left alone)" }[decision];
      console.log(`${decision === "already" ? "unchanged" : "skipped  "} ${label}: ${why}`);
      count(decision === "already" ? "unchanged" : "skipped");
      continue;
    }
    if (!apply) {
      console.log(`would fix ${label}`);
      count("would fix");
      continue;
    }
    const update: Record<string, unknown> = { [column.name]: withLanguage(value, valid.lang, to) };
    // A stale Markdown source of this language would show the old text in the editor: the editor falls back to the new HTML.
    const sources = current.intro_source as Record<string, string> | null | undefined;
    if (sources && valid.lang in sources) update.intro_source = withLanguage(sources, valid.lang, "");
    const { error: writeError } = await supabase.from(config.table).update(update).eq(config.primaryKey, valid.id);
    if (writeError) throw new Error(`${label}: ${writeError.message}`);
    const { error: auditError } = await supabase.from("audit_log").insert({
      actor_id: null,
      actor_name: "Translation review",
      action: "translation.review",
      table_name: config.table,
      row_id: valid.id,
      details: { column: column.name, lang: valid.lang },
    });
    if (auditError) console.log(`warning   ${label}: the audit entry failed (${auditError.message})`);
    console.log(`fixed     ${label}`);
    count("fixed");
  }

  console.log(`\n${fixes.length} fix(es): ${[...counts].map(([k, n]) => `${n} ${k}`).join(", ") || "nothing to do"}.`);
  if (!apply && (counts.get("would fix") ?? 0) > 0) console.log("Nothing was written. Run again with --apply to write them.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
