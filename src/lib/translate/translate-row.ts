import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeRichText } from "@/lib/html";
import { DEFAULT_LOCALE } from "@/lib/i18n/languages";
import type { Localized } from "@/lib/i18n/localized";
import { translateFields, withRetry } from "./gemini";
import { sourceHash } from "./hash";
import { getTranslatableTable, isTranslatableRow, type TranslatableTable } from "./tables";

/**
 * Translate database rows into every enabled language that is missing or
 * outdated, then write the translations back.
 *
 * Loop safety: each row's `source_hash` is compared with a hash of its current
 * English text. When they match and every language is present, nothing is
 * done — so the UPDATE this module performs (which fires the webhook again)
 * is a no-op on the second round.
 *
 * Request economy: rows that need the same language are batched into one
 * Gemini request (up to a character budget), which keeps the free tier happy.
 */

export interface TranslateOptions {
  /** Re-translate every language even when up to date. */
  force?: boolean;
  /** Only these locales (default: all enabled, except English). */
  onlyLocales?: string[];
  /** Report what would happen without calling Gemini or writing. */
  dryRun?: boolean;
  log?: (message: string) => void;
}

export interface TranslateRowResult {
  table: string;
  id: string;
  translated: string[];
  skipped: boolean;
  reason?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/** Characters of English source per Gemini request. */
const BATCH_CHAR_BUDGET = 9000;
const BATCH_MAX_ROWS = 40;

function asLocalized(value: unknown): Localized {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Localized = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
    return out;
  }
  if (typeof value === "string") return { [DEFAULT_LOCALE]: value };
  return {};
}

export async function getEnabledLocalesForTranslation(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("languages").select("code").eq("enabled", true).order("sort_order");
  if (error) throw error;
  return (data ?? []).map((r) => r.code as string).filter((c) => c !== DEFAULT_LOCALE);
}

interface RowState {
  id: string;
  columns: Record<string, Localized>;
  source: Record<string, string>;
  hash: string;
  missing: string[];
  done: Set<string>;
  chars: number;
}

function prepareRow(config: TranslatableTable, row: Row, targets: string[], force: boolean): RowState | TranslateRowResult {
  const id = String(row[config.primaryKey]);
  const columns: Record<string, Localized> = {};
  const source: Record<string, string> = {};
  let chars = 0;
  for (const column of config.columns) {
    columns[column.name] = asLocalized(row[column.name]);
    source[column.name] = columns[column.name][DEFAULT_LOCALE] ?? "";
    chars += source[column.name].length;
  }

  if (!Object.values(source).some((text) => text.trim() !== "")) {
    return { table: config.table, id, translated: [], skipped: true, reason: "no English source text" };
  }

  const hash = sourceHash(source);
  const upToDate = row.source_hash === hash;
  const missing = force
    ? targets
    : targets.filter((locale) => {
        if (!upToDate) return true;
        return config.columns.some((c) => source[c.name].trim() !== "" && !(columns[c.name][locale] ?? "").trim());
      });

  if (missing.length === 0) return { table: config.table, id, translated: [], skipped: true, reason: "up to date" };
  return { id, columns, source, hash, missing, done: new Set(), chars };
}

/**
 * Translate many rows of one table. Rows must contain the primary key, the
 * localized columns and `source_hash`.
 */
export async function translateRows(
  supabase: SupabaseClient,
  table: string,
  rows: Row[],
  enabledLocales: string[],
  options: TranslateOptions = {},
): Promise<TranslateRowResult[]> {
  const log = options.log ?? (() => {});
  const config = getTranslatableTable(table);
  if (!config) {
    return rows.map((row) => ({ table, id: String(row?.id ?? row?.key ?? "?"), translated: [], skipped: true, reason: "table not translatable" }));
  }

  const targets = (options.onlyLocales ?? enabledLocales).filter((l) => l !== DEFAULT_LOCALE);
  const results: TranslateRowResult[] = [];
  const pending: RowState[] = [];

  for (const row of rows) {
    if (!isTranslatableRow(table, row)) continue;
    const prepared = prepareRow(config, row, targets, Boolean(options.force));
    if ("skipped" in prepared) results.push(prepared);
    else pending.push(prepared);
  }

  if (pending.length === 0) return results;

  if (options.dryRun) {
    for (const state of pending) {
      log(`${table}/${state.id}: would translate into ${state.missing.join(", ")}`);
      results.push({ table, id: state.id, translated: state.missing, skipped: false });
    }
    return results;
  }

  const htmlColumns = config.columns.filter((c) => c.html).map((c) => c.name);
  const context = contextFor(table);
  const failures = new Map<string, string>();

  for (const locale of targets) {
    const needing = pending.filter((s) => s.missing.includes(locale));
    for (const batch of chunk(needing)) {
      // Field keys are opaque ("f0", "f1", ...) so the model never sees ids.
      const fieldMap: Array<{ key: string; state: RowState; column: string }> = [];
      const fields: Record<string, string> = {};
      for (const state of batch) {
        for (const column of config.columns) {
          const text = state.source[column.name];
          if (!text.trim()) continue;
          const key = `f${fieldMap.length}`;
          fieldMap.push({ key, state, column: column.name });
          fields[key] = text;
        }
      }
      const htmlFields = fieldMap.filter((f) => htmlColumns.includes(f.column)).map((f) => f.key);

      log(`${table}: translating ${batch.length} row(s) into ${locale} (${Object.keys(fields).length} fields)`);
      try {
        const translated = await withRetry(() => translateFields(fields, locale, { htmlFields, context }));
        for (const { key, state, column } of fieldMap) {
          const text = translated[key];
          if (typeof text !== "string" || !text.trim()) continue;
          const isHtml = htmlColumns.includes(column);
          state.columns[column] = { ...state.columns[column], [locale]: isHtml ? sanitizeRichText(text) : text };
        }
        for (const state of batch) state.done.add(locale);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`${table}: ${locale} batch failed — ${message}`);
        for (const state of batch) failures.set(state.id, message);
      }
    }
  }

  for (const state of pending) {
    const complete = state.missing.every((l) => state.done.has(l));
    if (state.done.size === 0) {
      results.push({ table, id: state.id, translated: [], skipped: true, reason: `failed: ${failures.get(state.id) ?? "unknown error"}` });
      continue;
    }
    const update: Row = {};
    for (const column of config.columns) update[column.name] = state.columns[column.name];
    // Only mark the row as up to date when every requested language succeeded;
    // otherwise the next run picks it up again.
    if (complete) update.source_hash = state.hash;

    const { error } = await supabase.from(table).update(update).eq(config.primaryKey, state.id);
    if (error) throw error;
    results.push({ table, id: state.id, translated: [...state.done], skipped: false, reason: complete ? undefined : "partial" });
  }

  return results;
}

/** Translate a single row (used by the webhook route). */
export async function translateRow(
  supabase: SupabaseClient,
  table: string,
  row: Row,
  enabledLocales: string[],
  options: TranslateOptions = {},
): Promise<TranslateRowResult> {
  const [result] = await translateRows(supabase, table, [row], enabledLocales, options);
  return result ?? { table, id: String(row?.id ?? row?.key ?? "?"), translated: [], skipped: true, reason: "not translatable" };
}

function chunk(states: RowState[]): RowState[][] {
  const batches: RowState[][] = [];
  let current: RowState[] = [];
  let chars = 0;
  for (const state of states) {
    if (current.length > 0 && (chars + state.chars > BATCH_CHAR_BUDGET || current.length >= BATCH_MAX_ROWS)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(state);
    chars += state.chars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function contextFor(table: string): string {
  switch (table) {
    case "ui_strings":
      return "Short interface labels and buttons of the website. Keep them short.";
    case "announcements":
      return "A kingdom announcement written by an admin.";
    case "events":
      return "Name and one-line summary of an in-game event.";
    case "rule_topics":
      return "The name of a group of kingdom rules (used as a tab label).";
    case "rules":
      return "A kingdom rule that every player must follow.";
    case "guides":
      return "A guide explaining how the kingdom plays an in-game event.";
    case "alliances":
      return "Description and joining requirements of an alliance.";
    case "gift_codes":
      return "What a gift code rewards.";
    case "site_settings":
      return "Site-wide text such as the kingdom name or tagline.";
    case "heroes":
      return "The name of a hero in Kingshot. Use the hero's official in-game name in the target language (the game transliterates names, e.g. Arabic أماني for Amane); never translate the name literally.";
    case "kvk_plans":
      return "Title and introduction of the kingdom's KvK battle plan, written by the coordinators for all players.";
    case "kvk_rules":
      return "A short instruction for players on KvK battle day (what to do or not do).";
    case "kvk_coordinators":
      return "A short note about a KvK coordinator, e.g. the languages they speak.";
    case "kvk_formations":
      return "A short note about a troop formation for KvK (when to use it).";
    default:
      return "";
  }
}
