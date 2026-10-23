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
