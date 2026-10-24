import { type RatingKey, type RetroConfig, shownRatings, shownTexts, type TextKey } from "./questions";

/**
 * CSV export of the responses (pure, unit-tested). Opens in Excel, Numbers and
 * Google Sheets: UTF-8 with a byte-order mark, CRLF line ends, every cell
 * quoted when needed. Cells that a spreadsheet would read as a formula get a
 * leading apostrophe so a player can't smuggle `=HYPERLINK(...)` into the
 * council's sheet. Identity is never part of the file: the row id is the
 * only identifier.
 */

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : typeof value === "string" ? value : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export interface CsvResponse {
  id: string;
  createdAt: string;
  allianceTag: string | null;
  verified: boolean;
  locale: string;
  ratings: Partial<Record<RatingKey, number>>;
  texts: Record<TextKey, string>;
}

/** One row per response; rating and text columns follow the retrospective's config. */
export function responsesCsv(responses: readonly CsvResponse[], config: RetroConfig): string {
  const ratings = shownRatings(config).map((q) => q.key);
  const texts = shownTexts(config).map((t) => t.key);
  const header = ["id", "submitted_utc", "alliance", "verified", "language", ...ratings.map((k) => `rating_${k}`), ...texts];
  const rows = responses.map((r) => [
    r.id,
    r.createdAt,
    r.allianceTag ?? "",
    r.verified ? "yes" : "no",
    r.locale,
    ...ratings.map((k) => (typeof r.ratings[k] === "number" ? r.ratings[k] : "")),
    ...texts.map((k) => r.texts[k] ?? ""),
  ]);
  return toCsv([header, ...rows]);
}

/** A safe download name: "feedback-castle-battle-1-nov.csv". */
export function csvFileName(slug: string): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "responses";
  return `feedback-${clean}.csv`;
}
