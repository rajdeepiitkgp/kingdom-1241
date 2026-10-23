/**
 * Which tables and columns the translation pipeline handles.
 * Every column listed is a Localized JSONB ({"en": ..., "de": ...}).
 */
export interface TranslatableTable {
  table: string;
  primaryKey: string;
  columns: Array<{ name: string; html: boolean }>;
}

export const TRANSLATABLE_TABLES: TranslatableTable[] = [
  { table: "ui_strings", primaryKey: "key", columns: [{ name: "text", html: false }] },
  {
    table: "announcements",
    primaryKey: "id",
    columns: [
      { name: "title", html: false },
      { name: "body", html: true },
    ],
  },
  {
    table: "events",
    primaryKey: "id",
    columns: [
      { name: "name", html: false },
      { name: "summary", html: false },
    ],
  },
  { table: "rule_topics", primaryKey: "id", columns: [{ name: "title", html: false }] },
  {
    table: "rules",
    primaryKey: "id",
    columns: [
      { name: "title", html: false },
      { name: "body", html: true },
    ],
  },
  {
    table: "guides",
    primaryKey: "id",
    columns: [
      { name: "title", html: false },
      { name: "summary", html: false },
      { name: "body", html: true },
    ],
  },
  {
    table: "alliances",
    primaryKey: "id",
    columns: [
      { name: "description", html: false },
      { name: "requirements", html: false },
    ],
  },
  { table: "gift_codes", primaryKey: "id", columns: [{ name: "rewards", html: false }] },
  { table: "heroes", primaryKey: "id", columns: [{ name: "name", html: false }] },
  {
    table: "kvk_plans",
    primaryKey: "id",
    columns: [
      { name: "title", html: false },
      { name: "intro", html: true },
    ],
  },
  { table: "kvk_rules", primaryKey: "id", columns: [{ name: "text", html: false }] },
  { table: "kvk_coordinators", primaryKey: "id", columns: [{ name: "note", html: false }] },
  { table: "kvk_formations", primaryKey: "id", columns: [{ name: "note", html: false }] },
  // site_settings is key/value; only the keys in TRANSLATABLE_SETTING_KEYS have a Localized value.
  { table: "site_settings", primaryKey: "key", columns: [{ name: "value", html: false }] },
];

export function getTranslatableTable(table: string): TranslatableTable | null {
  return TRANSLATABLE_TABLES.find((t) => t.table === table) ?? null;
}

/** `site_settings` rows whose value is a Localized object. */
export const TRANSLATABLE_SETTING_KEYS = ["kingdom_name", "tagline", "transfer_contact"];

/** Rows of a table that the pipeline should translate (filters site_settings). */
export function isTranslatableRow(table: string, row: Record<string, unknown>): boolean {
  if (table === "site_settings") return TRANSLATABLE_SETTING_KEYS.includes(String(row.key));
  return true;
}
