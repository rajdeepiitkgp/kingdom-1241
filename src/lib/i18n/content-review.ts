// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { GlossaryEntry } from "@/lib/translate/glossary";
import type { Localized } from "./localized";
import { glossaryFindings, placeholderSignature, type ReviewText, reviewHash, styleFindings } from "./ui-review";

/**
 * Review of admin-written content (the active battle plan with its leader,
 * checklist and feedback pages, and the public content) in the
 * machine-translated languages, for the `/translation-review` skill. Pure; the
 * scripts `content-review.ts` (read-only export) and `content-fixes.ts` (the
 * owner applies the fixes) feed it.
 *
 * View first: a text is only changed when its meaning is wrong or a word
 * misleads. A language a moderator corrected by hand (audit
 * `translation.update`) is shown as such and left alone. A fix replaces one
 * language of one text, and only while the English is the one it was
 * reviewed against and the translation is still the one it replaces, so a
 * newer correction or a fresh machine translation is never overwritten.
 */

export interface ManualCorrection {
  at: string;
  by: string;
}

export interface ContentCell {
  table: string;
  id: string;
  column: string;
  html: boolean;
  /** Every language of the column. */
  value: Localized;
  /** Languages a moderator corrected by hand. */
  manual: Record<string, ManualCorrection>;
}

export interface ContentItem {
  table: string;
  id: string;
  column: string;
  html: boolean;
  en: string;
  /** New or changed since the last recorded review. */
  changed: boolean;
  texts: Record<string, ReviewText & { manual?: ManualCorrection }>;
}

export const cellKey = (cell: { table: string; id: string; column: string }) => `${cell.table}:${cell.id}:${cell.column}`;

/** The tag sequence of an HTML text: a translation keeps the structure of the English. */
export const tagSignature = (html: string) => (html.match(/<\/?[a-z][a-z0-9]*/gi) ?? []).map((tag) => tag.toLowerCase()).join(",");

const plain = (html: string) => html.replace(/<[^>]+>/g, " ");

/** Automatic findings for one language of a text. */
export function contentFindings(cell: ContentCell, locale: string, glossary: readonly GlossaryEntry[]): string[] {
  const en = cell.value.en ?? "";
  const text = cell.value[locale] ?? "";
  if (!text.trim()) return ["missing: no translation yet"];
  const findings: string[] = [];
  if (placeholderSignature(text) !== placeholderSignature(en)) findings.push("placeholders differ from the English");
  if (cell.html && tagSignature(text) !== tagSignature(en)) findings.push("html: the tags differ from the English");
  findings.push(...glossaryFindings(plain(en), plain(text), locale, glossary));
  findings.push(...styleFindings(plain(text), locale));
  return findings;
}

const isHard = (finding: string) => /^(missing:|placeholders|html:)/.test(finding);
const isHint = (finding: string) => /^(glossary|style):/.test(finding);

/** The hash recorded when a text has been reviewed. */
export const cellHash = (cell: ContentCell, locales: readonly string[]) =>
  reviewHash(cell.value.en ?? "", Object.fromEntries(locales.map((l) => [l, cell.value[l] ?? ""])));

/**
 * Texts to look at: changed since the last review, or with an error in a
 * language nobody corrected by hand. Hints on a text reviewed before only
 * come back with `all`.
 */
export function reviewContent(cells: readonly ContentCell[], locales: readonly string[], glossary: readonly GlossaryEntry[], state: Record<string, string>, options: { all?: boolean } = {}): ContentItem[] {
  const items: ContentItem[] = [];
  for (const cell of cells) {
    const en = cell.value.en ?? "";
    if (!en.trim()) continue;
    const texts: ContentItem["texts"] = {};
    let hard = false;
    let hint = false;
    for (const locale of locales) {
      const manual = cell.manual[locale];
      const findings = contentFindings(cell, locale, glossary);
      if (!manual && findings.some(isHard)) hard = true;
      if (!manual && findings.some(isHint)) hint = true;
      texts[locale] = { text: cell.value[locale] ?? "", findings, ...(manual ? { manual } : {}) };
    }
    const changed = state[cellKey(cell)] !== cellHash(cell, locales);
    if (changed || hard || (options.all && hint)) items.push({ table: cell.table, id: cell.id, column: cell.column, html: cell.html, en, changed, texts });
  }
  return items;
}

/** One reviewed fix: replaces `from` with `to` in `lang`, while the English is still `en`. */
export interface ContentFix {
  table: string;
  id: string;
  column: string;
  lang: string;
  en: string;
  from: string;
  to: string;
}

/** What is wrong with a fix before anything is read (null column info = not a translatable column). */
export function fixProblems(fix: Partial<ContentFix>, column: { html: boolean } | null): string[] {
  const problems: string[] = [];
  if (!column) problems.push("not a translatable column");
  if (!fix.lang || fix.lang === "en" || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(fix.lang)) problems.push("lang must be a language other than English");
  if (typeof fix.id !== "string" || !fix.id) problems.push("id is missing");
  if (typeof fix.en !== "string" || !fix.en.trim()) problems.push("en is missing");
  if (typeof fix.from !== "string") problems.push("from is missing");
  if (typeof fix.to !== "string" || !fix.to.trim()) problems.push("to is empty");
  if (problems.length > 0) return problems;
  if (placeholderSignature(fix.to as string) !== placeholderSignature(fix.en as string)) problems.push("to loses or adds a placeholder");
  if (column?.html && tagSignature(fix.to as string) !== tagSignature(fix.en as string)) problems.push("to has other HTML tags than the English");
  return problems;
}

export type FixDecision = "apply" | "already" | "english-changed" | "text-changed";

/** Compare-and-swap: write only while the English and the translation are the ones that were reviewed. */
export function fixDecision(current: Localized | null | undefined, fix: Pick<ContentFix, "lang" | "en" | "from" | "to">): FixDecision {
  if ((current?.en ?? "") !== fix.en) return "english-changed";
  const now = current?.[fix.lang] ?? "";
  if (now === fix.to) return "already";
  return now === fix.from ? "apply" : "text-changed";
}
