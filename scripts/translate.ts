// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Translate content in Supabase with the configured provider (Anthropic Claude or Gemini).
 *
 *   npm run translate                         # everything that is missing or outdated
 *   npm run translate -- --table guides       # one table only
 *   npm run translate -- --locale de          # one language only
 *   npm run translate -- --force              # re-translate even if up to date
 *   npm run translate -- --dry-run            # show what would be translated
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and a provider key
 * (ANTHROPIC_API_KEY, or GEMINI_API_KEY; TRANSLATION_PROVIDER picks between them).
 * Optional: SITE_URL + TRANSLATE_WEBHOOK_SECRET to refresh the site cache afterwards.
 */
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));

async function main() {
  const [{ createAdminClient }, { TRANSLATABLE_TABLES }, { getEnabledLocalesForTranslation, translateRows }, provider] =
    await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/lib/translate/tables"),
      import("@/lib/translate/translate-row"),
      import("@/lib/translate/provider"),
    ]);

  const dryRun = args["dry-run"] === true;
  if (!dryRun && !provider.isTranslationConfigured()) {
    throw new Error(
      "Translation is off: set ANTHROPIC_API_KEY (or GEMINI_API_KEY), or TRANSLATION_PROVIDER=anthropic|gemini (see SETUP.md).",
    );
  }
  console.log(`Provider: ${await provider.translationProviderLabel()}`);

  const supabase = createAdminClient();
  const enabled = await getEnabledLocalesForTranslation(supabase);
  const onlyLocales = typeof args.locale === "string" ? args.locale.split(",").map((s) => s.trim()) : undefined;
  const tables = typeof args.table === "string" ? args.table.split(",").map((s) => s.trim()) : TRANSLATABLE_TABLES.map((t) => t.table);

  console.log(`Target languages: ${(onlyLocales ?? enabled).join(", ") || "(none enabled)"}`);

  let translatedRows = 0;
  let skipped = 0;
  let failed = 0;

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    const results = await translateRows(supabase, table, data ?? [], enabled, {
      force: args.force === true,
      onlyLocales,
      dryRun,
      log: (message) => console.log(`  ${message}`),
    });
    const done = results.filter((r) => !r.skipped).length;
    const failures = results.filter((r) => r.skipped && r.reason?.startsWith("failed"));
    translatedRows += done;
    skipped += results.length - done - failures.length;
    failed += failures.length;
    console.log(`${table}: ${done} translated, ${results.length - done - failures.length} up to date, ${failures.length} failed`);
  }

  console.log(`\n${dryRun ? "Dry run — " : ""}${translatedRows} row(s) translated, ${skipped} skipped, ${failed} failed.`);
  if (!dryRun && provider.translationProvider() === "anthropic") {
    const { getAnthropicUsage } = await import("@/lib/translate/anthropic");
    const u = getAnthropicUsage();
    console.log(`Anthropic usage: ${u.requests} request(s), ${u.inputTokens.toLocaleString()} input + ${u.outputTokens.toLocaleString()} output tokens.`);
  }

  if (!dryRun && translatedRows > 0) await refreshSiteCache();
  if (failed > 0) process.exitCode = 1;
}

async function refreshSiteCache() {
  const siteUrl = process.env.SITE_URL?.trim();
  const secret = process.env.TRANSLATE_WEBHOOK_SECRET?.trim();
  if (!siteUrl || !secret) {
    console.log("Tip: set SITE_URL and TRANSLATE_WEBHOOK_SECRET to refresh the live site cache automatically.");
    return;
  }
  try {
    const res = await fetch(`${siteUrl.replace(/\/$/, "")}/api/revalidate`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: "{}",
    });
    console.log(res.ok ? "Site cache refreshed." : `Cache refresh failed: HTTP ${res.status}`);
  } catch (error) {
    console.log(`Cache refresh failed: ${error instanceof Error ? error.message : error}`);
  }
}

main().catch((error) => {
  console.error("Translation failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
