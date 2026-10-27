// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { createHash } from "node:crypto";

/**
 * Stable hash of the English source of a row. Stored in `source_hash` after
 * translating; when it matches, the row's translations are up to date.
 */
export function sourceHash(fields: Record<string, string>): string {
  const keys = Object.keys(fields).sort();
  const hash = createHash("sha256");
  for (const key of keys) {
    hash.update(key);
    hash.update("\u0000");
    hash.update(fields[key] ?? "");
    hash.update("\u0000");
  }
  return hash.digest("hex").slice(0, 32);
}

/**
 * Per-column hashes, stored together in `source_hash` as JSON
 * (`{"title":"…","intro":"…"}`), so that changing one column of a row only
 * re-translates that column. Older rows hold a single hash of all columns;
 * `storedColumnHashes` expands it when it still matches, so the format change
 * never re-translates anything by itself.
 */

/** Hash of each column's English text, keyed by column name. */
export function columnHashes(source: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [column, text] of Object.entries(source)) out[column] = sourceHash({ [column]: text });
  return out;
}

/** Serialise per-column hashes for the `source_hash` column (sorted keys, stable output). */
export function encodeColumnHashes(hashes: Record<string, string>): string {
  const sorted = Object.fromEntries(Object.keys(hashes).sort().map((k) => [k, hashes[k]]));
  return JSON.stringify(sorted);
}

/**
 * The per-column hashes a stored `source_hash` stands for: the JSON map itself,
 * a legacy whole-row hash expanded to every column while it still matches
 * the current English, or nothing.
 */
export function storedColumnHashes(stored: unknown, source: Record<string, string>): Record<string, string> {
  if (typeof stored !== "string" || !stored) return {};
  if (stored.startsWith("{")) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [string, string][]);
      }
    } catch {
      return {};
    }
    return {};
  }
  return stored === sourceHash(source) ? columnHashes(source) : {};
}

/** Columns whose English text differs from what was last translated (or was never translated). */
export function staleColumns(source: Record<string, string>, stored: unknown): string[] {
  const current = columnHashes(source);
  const known = storedColumnHashes(stored, source);
  return Object.keys(source).filter((column) => source[column].trim() !== "" && known[column] !== current[column]);
}
