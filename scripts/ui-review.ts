// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Read-only export for the `/translation-review` skill
 * (.claude/skills/translation-review/SKILL.md): the live interface strings in
 * the machine-translated languages, with automatic findings, limited to what
 * changed since the last review or has a finding.
 *
 *   npm run ui:review -- --out <dir>                 # writes <dir>/review.json and prints a summary
 *   npm run ui:review -- --out <dir> --prefix sync.  # only keys starting with sync. (comma list)
 *   npm run ui:review -- --out <dir> --all           # also hints on strings reviewed before
 *   npm run ui:review -- --mark-reviewed [--prefix …] # records today's strings as reviewed
 *
 * Uses only the public (anon) key: NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY). It never writes to the
 * database and never calls a translation provider; fixes go into
 * src/content/seed/ui-reviewed.ts and reach the site through `sync-ui`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const STATE_FILE = resolve(process.cwd(), ".claude/skills/translation-review/state.json");

async function main() {
  const [{ createClient }, { supabaseAnonKey, supabaseUrl }, { UI_STRINGS }, { REVIEWED_UI }, { GLOSSARY }, review] = await Promise.all([
    import("@supabase/supabase-js"),
    import("@/lib/supabase/env"),
    import("@/content/seed/ui-strings"),
    import("@/content/seed/ui-reviewed"),
    import("@/lib/translate/glossary"),
    import("@/lib/i18n/ui-review"),
  ]);

  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see SETUP.md).");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: languages, error: langError } = await supabase.from("languages").select("code").eq("enabled", true).order("sort_order");
  if (langError) throw new Error(`languages: ${langError.message}`);
  const live: Record<string, Record<string, string>> = {};
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("ui_strings").select("key, text").order("key").range(from, from + 999);
    if (error) throw new Error(`ui_strings: ${error.message}`);
    for (const row of data ?? []) live[String(row.key)] = (row.text ?? {}) as Record<string, string>;
    if (!data || data.length < 1000) break;
  }

  const strings = UI_STRINGS as Record<string, Record<string, string>>;
  const english = Object.fromEntries(Object.entries(strings).map(([k, text]) => [k, text.en]));
  const handWritten = Object.fromEntries(Object.entries(strings).map(([k, text]) => [k, Object.keys(text)]));
  const allHandWritten = new Set(Object.values(handWritten).flat());
  const locales = (languages ?? []).map((l) => String(l.code)).filter((code) => !allHandWritten.has(code));
  let state: Record<string, string> = {};
  try {
    state = JSON.parse(readFileSync(STATE_FILE, "utf8")) as Record<string, string>;
  } catch {
    // First run: everything counts as changed.
  }
  const input = { english, handWritten, live, locales, glossary: GLOSSARY, reviewed: REVIEWED_UI as Record<string, Record<string, string> | undefined>, state };
  const prefixes = typeof args.prefix === "string" ? args.prefix.split(",").map((p) => p.trim()).filter(Boolean) : [];
  const inScope = (k: string) => prefixes.length === 0 || prefixes.some((p) => k.startsWith(p));

  if (args["mark-reviewed"] === true) {
    for (const k of Object.keys(english).filter(inScope)) state[k] = review.reviewHash(english[k], review.expectedTexts(input, k));
    for (const k of Object.keys(state)) if (!(k in english)) delete state[k];
    mkdirSync(dirname(STATE_FILE), { recursive: true });
    writeFileSync(STATE_FILE, `${JSON.stringify(Object.fromEntries(Object.entries(state).sort()), null, 1)}\n`);
    console.log(`Recorded ${Object.keys(english).filter(inScope).length} string(s) as reviewed in ${STATE_FILE}.`);
    return;
  }

  if (typeof args.out !== "string") throw new Error("Pass --out <dir> (or --mark-reviewed).");
  const items = review.reviewItems(input, inScope, { all: args.all === true });
  const glossary = Object.fromEntries(
    locales.map((l) => [l, GLOSSARY.map((e) => ({ term: e.term, use: e.keep ? e.term : (e.translations?.[l] ?? null), note: e.note ?? null }))]),
  );
  const out = resolve(args.out);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "review.json"), JSON.stringify({ generatedAt: new Date().toISOString(), locales, glossary, items }, null, 1));

  console.log(`Machine-translated languages: ${locales.join(", ") || "(none)"}`);
  console.log(`${items.length} string(s) to look at (${items.filter((i) => i.changed).length} new or changed since the last review).`);
  for (const locale of locales) {
    const counts = new Map<string, number>();
    for (const item of items) for (const f of item.texts[locale]?.findings ?? []) counts.set(f.split(":")[0], (counts.get(f.split(":")[0]) ?? 0) + 1);
    console.log(`  ${locale}: ${[...counts].map(([kind, n]) => `${n} ${kind}`).join(", ") || "no findings"}`);
  }
  const pending = review.pendingFixes(input);
  if (pending > 0) console.log(`${pending} reviewed fix(es) aren't on the site yet: run Maintenance → sync-ui once the deployment of main is Ready.`);
  console.log(`Wrote ${join(out, "review.json")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
