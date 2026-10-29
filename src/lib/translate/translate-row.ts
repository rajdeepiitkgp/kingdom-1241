// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeRichText } from "@/lib/html";
import { DEFAULT_LOCALE } from "@/lib/i18n/languages";
import type { Localized } from "@/lib/i18n/localized";
import { restoreImages, type Shielded, shieldImages } from "./images";
import { translateFields, withRetry } from "./provider";
import { columnHashes, encodeColumnHashes, staleColumns, storedColumnHashes } from "./hash";
import { getTranslatableTable, isHtmlField, isTranslatableRow, type TranslatableTable } from "./tables";

/**
 * Translate database rows into every enabled language that is missing or
 * outdated, then write the translations back.
 *
 * Loop safety and economy: `source_hash` holds one hash per translatable
 * column (JSON; older rows hold one hash for the whole row). A column is only
 * sent to the model when its English changed or a language is missing, so
 * editing a plan's title never re-translates its long intro. When everything
 * matches and every language is present, nothing is done — so the UPDATE this
 * module performs (which fires the webhook again) is a no-op on the second round.
 *
 * Request economy: rows that need the same language are batched into one
 * provider request (up to a character budget), which keeps costs and quotas low.
 */

export interface TranslateOptions {
  /** Re-translate every language even when up to date. */
  force?: boolean;
  /** Only these locales (default: all enabled, except English). */
  onlyLocales?: string[];
  /** Report what would happen without calling the provider or writing. */
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

/** Characters of English source per provider request. */
const BATCH_CHAR_BUDGET = 9000;
const BATCH_MAX_ROWS = 40;
/**
 * Languages translated at the same time. One after another, a long guide in
 * nine languages could outlast the webhook route's time limit and lose every
 * translation of the run; a few at a time stays inside it and inside the
 * provider's rate limits.
 */
const PARALLEL_LOCALES = 3;

/** Runs `task` for every item, at most `limit` at a time. */
async function eachLimited<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await task(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

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
  /** Current per-column hashes of the English text. */
  hashes: Record<string, string>;
  /** Per-column hashes already stored (a legacy whole-row hash is expanded). */
  stored: Record<string, string>;
  /** locale → columns that need a translation. */
  needs: Map<string, Set<string>>;
  /** locale → columns translated in this run. */
  done: Map<string, Set<string>>;
  /** Columns whose English changed since their translations were made. */
  stale: Set<string>;
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
  }

  if (!Object.values(source).some((text) => text.trim() !== "")) {
    return { table: config.table, id, translated: [], skipped: true, reason: "no English source text" };
  }

  const hashes = columnHashes(source);
  const stored = storedColumnHashes(row.source_hash, source);
  const stale = new Set(staleColumns(source, row.source_hash));
  const needs = new Map<string, Set<string>>();
  for (const locale of targets) {
    const wanted = new Set<string>();
    for (const column of config.columns) {
      if (!source[column.name].trim()) continue;
      if (force || stale.has(column.name) || !(columns[column.name][locale] ?? "").trim()) wanted.add(column.name);
    }
    if (wanted.size > 0) needs.set(locale, wanted);
  }
  if (needs.size === 0) return { table: config.table, id, translated: [], skipped: true, reason: "up to date" };

  chars = 0;
  for (const column of new Set([...needs.values()].flatMap((set) => [...set]))) chars += source[column].length;
  return { id, columns, source, hashes, stored, needs, done: new Map(), stale, chars };
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
      const summary = [...state.needs.entries()].map(([locale, cols]) => `${locale} (${[...cols].join(", ")})`).join(", ");
      log(`${table}/${state.id}: would translate ${summary}`);
      results.push({ table, id: state.id, translated: [...state.needs.keys()], skipped: false });
    }
    return results;
  }

  const context = contextFor(table);
  const failures = new Map<string, string>();

  await eachLimited(targets, PARALLEL_LOCALES, async (locale) => {
    const needing = pending.filter((s) => s.needs.has(locale));
    for (const batch of chunk(needing)) {
      // Field keys are opaque ("f0", "f1", ...) so the model never sees ids.
      const fieldMap: Array<{ key: string; state: RowState; column: string; html: boolean; shielded: Shielded }> = [];
      const fields: Record<string, string> = {};
      for (const state of batch) {
        for (const column of config.columns) {
          if (!state.needs.get(locale)?.has(column.name)) continue;
          const key = `f${fieldMap.length}`;
          // Images travel as placeholders and come back untouched (images.ts).
          const html = isHtmlField(table, state.id, column);
          const shielded = html ? shieldImages(state.source[column.name]) : { text: state.source[column.name], images: [] };
          fieldMap.push({ key, state, column: column.name, html, shielded });
          fields[key] = shielded.text;
        }
      }
      const htmlFields = fieldMap.filter((f) => f.html).map((f) => f.key);

      log(`${table}: translating ${batch.length} row(s) into ${locale} (${Object.keys(fields).length} fields)`);
      try {
        // An answer that lost or moved an image is asked for once more; still wrong,
        // that language keeps the English text (images in place) until the next run.
        let open = fieldMap;
        for (let attempt = 0; attempt < 2 && open.length > 0; attempt++) {
          const ask = Object.fromEntries(open.map((f) => [f.key, fields[f.key]]));
          const translated = await withRetry(() => translateFields(ask, locale, { htmlFields: htmlFields.filter((key) => key in ask), context }));
          const moved: typeof fieldMap = [];
          for (const entry of open) {
            const { key, state, column, html: isHtml, shielded } = entry;
            const text = translated[key];
            if (typeof text !== "string" || !text.trim()) continue;
            const restored = isHtml ? restoreImages(text, shielded) : text;
            if (restored === null) {
              moved.push(entry);
              continue;
            }
            state.columns[column] = { ...state.columns[column], [locale]: isHtml ? sanitizeRichText(restored) : restored };
            if (!state.done.has(locale)) state.done.set(locale, new Set());
            state.done.get(locale)!.add(column);
          }
          if (moved.length > 0) {
            const which = moved.map((f) => `${f.state.id}.${f.column}`).join(", ");
            log(`${table}: the ${locale} translation lost or moved an image (${which}); ${attempt === 0 ? "asking again" : "English stays until the next run"}`);
          }
          open = moved;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`${table}: ${locale} batch failed — ${message}`);
        for (const state of batch) failures.set(state.id, message);
      }
    }
  });

  for (const state of pending) {
    const translatedLocales = [...state.done.keys()];
    if (translatedLocales.length === 0) {
      results.push({ table, id: state.id, translated: [], skipped: true, reason: `failed: ${failures.get(state.id) ?? "unknown error"}` });
      continue;
    }
    // Re-read before writing. An English edit made while we were translating
    // must win: writing back the object we started from would revert it. The
    // newer edit's own run translates it, so this run simply steps aside. The
    // merge also keeps any language edited by hand in the meantime.
    const { data: current, error: readError } = await supabase.from(table).select("*").eq(config.primaryKey, state.id).maybeSingle();
    if (readError) throw readError;
    if (!current) {
      results.push({ table, id: state.id, translated: [], skipped: true, reason: "row deleted meanwhile" });
      continue;
    }
    const currentSource: Record<string, string> = {};
    for (const column of config.columns) currentSource[column.name] = asLocalized(current[column.name])[DEFAULT_LOCALE] ?? "";
    const currentHashes = columnHashes(currentSource);
    if (config.columns.some((c) => currentHashes[c.name] !== state.hashes[c.name])) {
      log(`${table}/${state.id}: English changed while translating, leaving it to the newer run`);
      results.push({ table, id: state.id, translated: [], skipped: true, reason: "superseded by a newer edit" });
      continue;
    }

    const update: Row = {};
    // Start from what is stored now: a run that finished meanwhile may have handled other columns.
    const stored = storedColumnHashes(current.source_hash, currentSource);
    let partial = false;
    for (const column of config.columns) {
      const name = column.name;
      const fresh: Localized = {};
      for (const [locale, cols] of state.done) if (cols.has(name)) fresh[locale] = state.columns[name][locale];
      const kept = asLocalized(current[name]);
      const neededBy = [...state.needs.entries()].filter(([, cols]) => cols.has(name)).map(([locale]) => locale);
      if (neededBy.some((locale) => !state.done.get(locale)?.has(name))) partial = true;
      if (state.stale.has(name) && stored[name] !== state.hashes[name]) {
        // The English changed: every translation this run didn't redo (a language
        // that failed, or one outside --locale) is outdated. It is dropped, so the
        // page falls back to English, and the column is marked as handled. The
        // missing languages are picked up by the next run on their own, so a
        // language that keeps failing costs one request per run, not a full
        // re-translation of every language and a webhook loop.
        update[name] = { [DEFAULT_LOCALE]: kept[DEFAULT_LOCALE] ?? state.source[name], ...fresh };
        stored[name] = state.hashes[name];
      } else {
        // Only missing languages were due: add what arrived; the stored hash stays.
        update[name] = { ...kept, ...fresh };
      }
    }
    update.source_hash = Object.keys(stored).length > 0 ? encodeColumnHashes(stored) : null;

    const { error } = await supabase.from(table).update(update).eq(config.primaryKey, state.id);
    if (error) throw error;
    results.push({ table, id: state.id, translated: translatedLocales, skipped: false, reason: partial ? "partial" : undefined });
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
    case "kvk_leader_briefs":
      return "Instructions for the players who lead rallies on KvK battle day, written by the coordinators.";
    case "kvk_leader_rules":
      return "A short instruction for the players who lead rallies or garrisons on KvK battle day.";
    case "kvk_rally_leaders":
      return "Which rally a player leads on KvK battle day (e.g. the castle, first wave), where on the map they teleport or stand, and a short note about it.";
    case "kvk_checklist_briefs":
      return "The brief for the battle commander and the coordinators who run the kingdom's side of a KvK or castle battle.";
    case "kvk_checklist_items":
      return "One task on the battle commander's checklist for a KvK or castle battle (to be ticked off), and an optional short note on who does it or how.";
    case "kvk_checklist_rules":
      return "A short order for the battle commander, or a general guideline for the coordinators, on KvK battle day.";
    default:
      return "";
  }
}
