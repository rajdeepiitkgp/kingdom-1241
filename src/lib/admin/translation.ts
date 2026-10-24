import type { Localized } from "@/lib/i18n/localized";
import { staleColumns } from "@/lib/translate/hash";
import { getTranslatableTable } from "@/lib/translate/tables";

/**
 * Per-language editing of translated text (server only: uses the pipeline's hash).
 *
 * English is the source: a change to it re-translates every language. Any other
 * language is corrected by hand for that language only, and the row's
 * `source_hash` is left alone, so the pipeline (which only acts when the hash of
 * the English text differs from the stored one) never re-translates a manual
 * correction, and no change can bounce between languages.
 */

/** Localized text columns the admin area edits per language (a subset of the pipeline's tables). */
export const EDITABLE_TEXT_COLUMNS: Record<string, readonly string[]> = {
  kvk_plans: ["title", "intro"],
  kvk_rules: ["text"],
  kvk_coordinators: ["note"],
  kvk_formations: ["note"],
};

export const TEXT_LIMITS: Record<string, number> = { title: 120, intro: 20000, text: 400, note: 200 };

export function isEditableTextColumn(table: string, column: string): boolean {
  return (EDITABLE_TEXT_COLUMNS[table] ?? []).includes(column);
}

/**
 * Columns of this row the pipeline still has to translate: their stored hash
 * differs from the hash of the current English text (the pipeline keeps one
 * hash per column, so a title edit leaves the intro alone).
 */
export function pendingColumns(table: string, row: Record<string, unknown>): string[] {
  const config = getTranslatableTable(table);
  if (!config) return [];
  const source: Record<string, string> = {};
  for (const column of config.columns) {
    const value = row[column.name];
    const en = value && typeof value === "object" ? (value as Localized).en : undefined;
    source[column.name] = typeof en === "string" ? en : "";
  }
  return staleColumns(source, row.source_hash);
}

/** True while any column of the row is still being translated. */
export function translationPending(table: string, row: Record<string, unknown>): boolean {
  return pendingColumns(table, row).length > 0;
}

/** The language being edited: a known enabled code, else English. */
export function parseEditLang(value: unknown, enabled: readonly string[]): string {
  return typeof value === "string" && enabled.includes(value) ? value : "en";
}

/** New value of a Localized column after a manual edit of one language (empty text removes that language → English fallback). */
export function withLanguage(current: Localized | null | undefined, lang: string, text: string): Localized {
  const next: Localized = { ...(current ?? {}) };
  if (text) next[lang] = text;
  else delete next[lang];
  return next;
}
