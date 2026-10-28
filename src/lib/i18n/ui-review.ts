// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { createHash } from "node:crypto";
import type { GlossaryEntry } from "@/lib/translate/glossary";
import type { Localized } from "./localized";

/**
 * Automatic checks for the `/translation-review` skill (pure; the script
 * `scripts/ui-review.ts` feeds it the live strings). The pipeline translates
 * every string on its own, so what goes wrong is consistency, not grammar: a
 * button named differently from the button, a game term that changes from one
 * text to the next, a broken placeholder, Japanese slipping into casual
 * endings. The findings point the reviewer at those strings; the reviewer
 * still reads everything that changed since the last review.
 */

export interface ReviewText {
  text: string;
  findings: string[];
}

export interface ReviewItem {
  key: string;
  en: string;
  /** New or changed since the last recorded review. */
  changed: boolean;
  /** The machine-translated languages, each with its findings. */
  texts: Record<string, ReviewText>;
  /** Reviewed fixes from ui-reviewed.ts that apply to this English. */
  reviewed?: Localized;
}

export interface ReviewInput {
  /** English of every interface string, from the code (ui-strings.ts). */
  english: Record<string, string>;
  /** Languages written by hand in the code, per key: never reviewed here. */
  handWritten: Record<string, string[]>;
  /** The live rows (key → every language). */
  live: Record<string, Localized>;
  /** Languages the site translates by machine. */
  locales: string[];
  glossary: readonly GlossaryEntry[];
  /** Reviewed fixes (ui-reviewed.ts), with the English they were reviewed against. */
  reviewed: Record<string, Localized | undefined>;
  /** Key → hash recorded at the last review (`reviewHash`). */
  state: Record<string, string>;
}

const PLACEHOLDER = /\{\{?[\w.:-]+\}?\}/g;
/** The placeholders of a text, sorted: `{n}`, `{{date}}`, `{{ui:key}}` must survive translation unchanged. */
export const placeholderSignature = (s: string) => (s.match(PLACEHOLDER) ?? []).sort().join(" ");

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A Latin-script word without its ending, so plurals and endings still match ("chefs", "eroi", "ralliements", Polish "zamku"). */
const stem = (word: string) => {
  if (!/^\p{Script=Latin}+$/u.test(word) || word.length < 4) return word;
  return word.slice(0, word.length - (word.length >= 5 ? 2 : 1));
};

/** Whether the translation uses the glossary term: every word longer than an article, in the language's own lower case. */
const usesTerm = (text: string, term: string, locale: string) => {
  const lower = text.toLocaleLowerCase(locale);
  const words = term.toLocaleLowerCase(locale).split(/\s+/);
  const significant = words.length > 1 ? words.filter((w) => w.length > 3) : words;
  return (significant.length > 0 ? significant : words).every((word) => lower.includes(stem(word)));
};

/**
 * Glossary terms in the English that the translation doesn't use. Longer
 * terms win ("Rally leader" before "Rally", "Kingdom 1241" before "Kingdom"),
 * so a term inside a longer one isn't checked twice.
 */
export function glossaryFindings(en: string, text: string, locale: string, glossary: readonly GlossaryEntry[]): string[] {
  const findings: string[] = [];
  let rest = en;
  for (const entry of [...glossary].sort((a, b) => b.term.length - a.term.length)) {
    const pattern = new RegExp(`\\b${escape(entry.term)}(?:s|es)?\\b`, "i");
    if (!pattern.test(rest)) continue;
    rest = rest.replace(new RegExp(pattern.source, "gi"), " ");
    const wanted = entry.keep ? entry.term : entry.translations?.[locale];
    if (wanted && !usesTerm(text, wanted, locale)) findings.push(`glossary: "${entry.term}" should be "${wanted}"`);
  }
  return findings;
}

/**
 * Labels of other strings that this English names (a button, a heading),
 * where the translation doesn't use that label's own translation. Only
 * capitalised multi-word or all-caps labels of the page count (not the
 * guide's own texts), whole words and longest first ("Too late for this hit
 * time" before "Too late"); spacing and case don't matter.
 */
export function labelFindings(key: string, en: string, text: string, locale: string, english: Record<string, string>, live: Record<string, Localized>): string[] {
  const findings: string[] = [];
  const flat = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const translationFlat = flat(text);
  let rest = en;
  const labels = Object.entries(english)
    .filter(([other, label]) => other !== key && !other.startsWith("tour.") && label.length >= 4)
    .filter(([, label]) => (/^\p{Lu}/u.test(label) && label.includes(" ")) || (label === label.toUpperCase() && /\p{L}/u.test(label)))
    .sort((a, b) => b[1].length - a[1].length);
  for (const [other, label] of labels) {
    const pattern = new RegExp(`(?<!\\p{L})${escape(label)}(?!\\p{L})`, "u");
    if (!pattern.test(rest)) continue;
    rest = rest.replace(new RegExp(pattern.source, "gu"), " ");
    const translated = live[other]?.[locale];
    if (translated && !translationFlat.includes(flat(translated))) findings.push(`label: "${label}" reads "${translated}" on the page (${other})`);
  }
  return findings;
}

/** Japanese should stay in the polite form (the language's style rule). */
export function styleFindings(text: string, locale: string): string[] {
  if (locale === "ja" && /(?:てね|しよう|(?:ね|よ)(?:[。！!]|$))/.test(text)) return ["style: casual Japanese ending (use です/ます)"];
  return [];
}

/** Hash of a key's English and machine translations, recorded when it has been reviewed. */
export function reviewHash(en: string, texts: Record<string, string>): string {
  const body = [en, ...Object.keys(texts).sort().map((l) => `${l}\u0000${texts[l]}`)].join("\u0001");
  return createHash("sha256").update(body).digest("hex").slice(0, 16);
}

/** The text each language will have once reviewed fixes are live (for the recorded state). */
export function expectedTexts(input: ReviewInput, key: string): Record<string, string> {
  const fix = input.reviewed[key];
  const applies = fix?.en === input.english[key];
  const out: Record<string, string> = {};
  for (const locale of input.locales) {
    if (input.handWritten[key]?.includes(locale)) continue;
    out[locale] = (applies ? fix?.[locale] : undefined) ?? input.live[key]?.[locale] ?? "";
  }
  return out;
}

/** Findings that are errors whatever the reviewer decided before. */
const isHard = (finding: string) => finding.startsWith("missing:") || finding.startsWith("placeholders");
/** Hints the reviewer judges (and may have judged already, as false alarms). */
const isHint = (finding: string) => /^(glossary|label|style):/.test(finding);

/**
 * Strings to look at: changed since the last review, or with an error (no
 * translation, broken placeholders). Hints on a string reviewed before only
 * come back with `all`, so a judged false alarm doesn't return every run.
 * While the site still has an older English (the code changed, `sync-ui`
 * hasn't run), its translation isn't checked: it is about to be replaced.
 */
export function reviewItems(input: ReviewInput, keyFilter: (key: string) => boolean = () => true, options: { all?: boolean } = {}): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const [key, en] of Object.entries(input.english)) {
    if (!keyFilter(key)) continue;
    const fix = input.reviewed[key]?.en === en ? input.reviewed[key] : undefined;
    const outdated = input.live[key]?.en !== undefined && input.live[key]?.en !== en;
    const texts: Record<string, ReviewText> = {};
    for (const locale of input.locales) {
      if (input.handWritten[key]?.includes(locale)) continue;
      const text = input.live[key]?.[locale] ?? "";
      const findings: string[] = [];
      if (outdated) findings.push("live: the site still has older English (run sync-ui)");
      else if (!text.trim()) findings.push("missing: no translation yet");
      else {
        if (placeholderSignature(text) !== placeholderSignature(en)) findings.push("placeholders differ from the English");
        findings.push(...glossaryFindings(en, text, locale, input.glossary));
        findings.push(...labelFindings(key, en, text, locale, input.english, input.live));
        findings.push(...styleFindings(text, locale));
      }
      if (fix?.[locale] !== undefined && fix[locale] !== text) findings.push("reviewed: the fix in ui-reviewed.ts isn't live yet (run sync-ui)");
      texts[locale] = { text, findings };
    }
    if (Object.keys(texts).length === 0) continue;
    const all = Object.values(texts).flatMap((t) => t.findings);
    const changed = input.state[key] !== reviewHash(en, expectedTexts(input, key));
    if (changed || all.some(isHard) || (options.all && all.some(isHint))) items.push({ key, en, changed, texts, ...(fix ? { reviewed: fix } : {}) });
  }
  return items;
}

/** How many reviewed fixes (key × language) the site doesn't show yet: `sync-ui` hasn't run since they were merged. */
export function pendingFixes(input: ReviewInput): number {
  let count = 0;
  for (const [key, fix] of Object.entries(input.reviewed)) {
    if (!fix || fix.en !== input.english[key]) continue;
    for (const [locale, text] of Object.entries(fix)) if (locale !== "en" && input.live[key]?.[locale] !== text) count += 1;
  }
  return count;
}
