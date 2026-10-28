import { getLanguageInfo } from "@/lib/i18n/languages";

/**
 * The owner's languages list (pure, unit-tested; the loader is settings-data.ts).
 * A language is added in code (registry, glossary, style, a review: SETUP.md);
 * on the settings page it is only shown, hidden and put in order, arranged in
 * the browser and written by one Save (every page shows the menu, so each
 * write makes the whole site render again).
 */

export interface TextCoverage {
  /** English texts across the translatable tables. */
  total: number;
  /** Per language: English texts without a translation in it (shown as English there). */
  missing: Record<string, number>;
}

/** Adds the texts of `rows` (their Localized `columns`) to `coverage`; values that aren't Localized with an English text don't count. */
export function addCoverage(coverage: TextCoverage, rows: ReadonlyArray<Record<string, unknown>>, columns: readonly string[], locales: readonly string[]): TextCoverage {
  let { total } = coverage;
  const missing = { ...coverage.missing };
  for (const locale of locales) missing[locale] ??= 0;
  for (const row of rows) {
    for (const column of columns) {
      const value = row[column];
      if (typeof value !== "object" || value === null) continue;
      const texts = value as Record<string, unknown>;
      if (typeof texts.en !== "string" || !texts.en.trim()) continue;
      total += 1;
      for (const locale of locales) {
        const text = texts[locale];
        if (typeof text !== "string" || !text.trim()) missing[locale] += 1;
      }
    }
  }
  return { total, missing };
}

/** Hiding English is refused: it is the source every other language falls back to. */
export function hideProblem(code: string): string | null {
  return code === "en" ? "English is the source language and always shown." : null;
}

/** One language of the list, in its place. */
export interface LanguageRow {
  code: string;
  shown: boolean;
}

/** What the list's Save sends: every code in the new order, and the hidden ones. */
export function languageFormValues(rows: readonly LanguageRow[]): { order: string; hidden: string } {
  return { order: rows.map((row) => row.code).join(","), hidden: rows.filter((row) => !row.shown).map((row) => row.code).join(",") };
}

const codeList = (value: unknown) => (typeof value === "string" ? value.split(",").map((code) => code.trim()).filter(Boolean) : []);

/**
 * Reads the Save against the codes in the database: the same languages, each
 * once (the page can't add or drop one), and English shown.
 */
export function parseLanguageForm(form: { get(name: string): unknown }, stored: readonly string[]): { ok: true; value: LanguageRow[] } | { ok: false; message: string } {
  const order = codeList(form.get("order"));
  const hidden = new Set(codeList(form.get("hidden")));
  const same = order.length === stored.length && new Set(order).size === order.length && order.every((code) => stored.includes(code));
  if (!same) return { ok: false, message: "The list of languages changed meanwhile. Reload the page and arrange it again." };
  if ([...hidden].some((code) => !order.includes(code))) return { ok: false, message: "That language is not on the list." };
  const problem = [...hidden].map(hideProblem).find(Boolean);
  if (problem) return { ok: false, message: problem };
  return { ok: true, value: order.map((code) => ({ code, shown: !hidden.has(code) })) };
}

export interface LanguageChanges {
  shown: string[];
  hidden: string[];
  /** The order of the codes changed. */
  moved: boolean;
}

export function languageChanges(before: readonly LanguageRow[], after: readonly LanguageRow[]): LanguageChanges {
  const wasShown = new Map(before.map((row) => [row.code, row.shown]));
  return {
    shown: after.filter((row) => row.shown && wasShown.get(row.code) === false).map((row) => row.code),
    hidden: after.filter((row) => !row.shown && wasShown.get(row.code) === true).map((row) => row.code),
    moved: before.map((row) => row.code).join(",") !== after.map((row) => row.code).join(","),
  };
}

export const hasLanguageChanges = (changes: LanguageChanges) => changes.moved || changes.shown.length > 0 || changes.hidden.length > 0;

/** "French hidden · Spanish shown · new order", for the unsaved line and the saved message. */
export function describeLanguageChanges(changes: LanguageChanges): string {
  const names = (codes: string[]) => codes.map((code) => getLanguageInfo(code).name).join(", ");
  return [
    changes.hidden.length > 0 && `${names(changes.hidden)} hidden`,
    changes.shown.length > 0 && `${names(changes.shown)} shown`,
    changes.moved && "new order",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function savedLanguagesMessage(changes: LanguageChanges): string {
  return [
    `Saved: ${describeLanguageChanges(changes)}.`,
    changes.shown.length > 0 && "Texts edited while a language was hidden are in English there until Maintenance → translate has run.",
    changes.hidden.length > 0 && "A hidden language's links open in the player's other language, and nothing is translated into it any more.",
  ]
    .filter(Boolean)
    .join(" ");
}
