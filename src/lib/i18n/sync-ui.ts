/**
 * What `npm run db:seed -- --sync-ui` writes to `ui_strings` (pure; the script
 * is scripts/seed.ts).
 *
 * The interface strings live in code with hand-written translations; the
 * pipeline adds the other languages in the database. A sync keeps those
 * languages while the English is unchanged, and writes a row only when the
 * result differs from what is stored: every written row fires the translation
 * webhook (one function run each), so rewriting all of them on every sync
 * made hundreds of calls that changed nothing.
 */

export interface UiStringRow {
  key: string;
  text: Record<string, string>;
  source_hash: string;
}

export interface StoredUiString {
  key: string;
  text: unknown;
  source_hash?: unknown;
}

export interface UiSyncPlan {
  /** Rows to upsert: new keys, changed texts and rows whose stored hash is off. */
  write: UiStringRow[];
  /** Keys whose stored row already equals what the code would write. */
  unchanged: number;
}

function textOf(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [language, text] of Object.entries(value as Record<string, unknown>)) {
    if (typeof text === "string") out[language] = text;
  }
  return out;
}

function sameText(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => b[k] === a[k]);
}

/**
 * The row to write for one key: the code's row, with the stored languages the
 * code doesn't have (the pipeline's) kept while the English is unchanged; a
 * changed English drops them, and the pipeline then translates again.
 */
export function mergeUiRow(row: UiStringRow, stored: StoredUiString | undefined): UiStringRow {
  const existing = stored ? textOf(stored.text) : null;
  if (!existing || existing.en !== row.text.en) return row;
  return { ...row, text: { ...existing, ...row.text } };
}

/** Splits the code's rows into those to write and those the database already holds as they are. */
export function uiRowsToWrite(rows: readonly UiStringRow[], stored: readonly StoredUiString[]): UiSyncPlan {
  const byKey = new Map(stored.map((s) => [s.key, s]));
  const write: UiStringRow[] = [];
  let unchanged = 0;
  for (const row of rows) {
    const current = byKey.get(row.key);
    const merged = mergeUiRow(row, current);
    const existing = current ? textOf(current.text) : null;
    if (existing && current?.source_hash === merged.source_hash && sameText(existing, merged.text)) unchanged += 1;
    else write.push(merged);
  }
  return { write, unchanged };
}
