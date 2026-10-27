import { isLocaleCode } from "@/lib/i18n/languages";
import type { Localized } from "@/lib/i18n/localized";

/**
 * Small, dependency-free helpers for turning `FormData` from the admin forms
 * into typed values, plus a few conversions shared by the editors. Everything
 * here is pure and unit-tested; the Server Actions only wire them together.
 */

export type FieldErrors = Record<string, string>;
export type FormResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

export function textField(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalText(fd: FormData, name: string): string | null {
  return textField(fd, name) || null;
}

/** Whole number within [min, max]; `null` when empty or not a number. */
export function intField(fd: FormData, name: string, min: number, max: number): number | null {
  const raw = textField(fd, name);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** Checkbox: present with any usual truthy value. */
export function boolField(fd: FormData, name: string): boolean {
  const value = fd.get(name);
  return value === "on" || value === "true" || value === "1";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** A row id from a hidden field; `null` unless it is a well-formed UUID (so a tampered form never reaches the database). */
export function uuidField(fd: FormData, name: string): string | null {
  const value = textField(fd, name);
  return isUuid(value) ? value : null;
}

/** The admin page's locale from its hidden `locale` field, used only to build redirect and revalidation paths. */
export function localeField(fd: FormData, name = "locale"): string {
  const value = textField(fd, name);
  return isLocaleCode(value) ? value : "en";
}

export function oneOfField<T extends string>(fd: FormData, name: string, allowed: readonly T[], fallback: T): T {
  const value = textField(fd, name);
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * A `datetime-local` value that the form labels as UTC ("2026-10-25T14:00")
 * → ISO timestamp. Empty → null. Unparseable → undefined (validation error).
 */
export function utcDateTimeField(fd: FormData, name: string): string | null | undefined {
  const raw = textField(fd, name);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) return undefined;
  const ms = Date.parse(`${raw}Z`);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

/** ISO timestamp → the value a `datetime-local` input needs, in UTC. */
export function toUtcInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString().slice(0, 16);
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * New value for a Localized column after an admin edited the English text.
 * The other languages are kept only while the English is unchanged: a stale
 * translation of a battle plan is worse than the English fallback, and the
 * translation pipeline refills the languages within seconds of the save.
 */
export function localizedUpdate(existing: Localized | null | undefined, english: string): Localized {
  if (existing && existing.en === english) return existing;
  return { en: english };
}

/** The English intro source the editor shows: the stored Markdown, else text derived from the HTML (rows written as HTML, e.g. the seed). */
export function shownIntroSource(introSource: Localized | null | undefined, intro: Localized | null | undefined): string {
  const stored = introSource?.en;
  return typeof stored === "string" && stored.trim() ? stored : htmlToEditableText(intro?.en ?? "");
}

/**
 * True when the posted English intro source is the one the editor showed, so
 * the English intro wasn't edited and its translations stay (comparing freshly
 * rendered HTML instead would drop them whenever the stored HTML came from an
 * older renderer, or from the seed).
 */
export function introSourceUnchanged(posted: string, shown: string): boolean {
  const normalize = (text: string) => text.replace(/\r\n?/g, "\n").trim();
  return normalize(posted) === normalize(shown);
}

/**
 * Rough HTML → Markdown-ish text, used once to open a row that was written as
 * HTML (the seed) in the Markdown editor. Paragraphs, line breaks, emphasis,
 * lists and quotes survive; everything else is flattened to text.
 */
export function htmlToEditableText(html: string): string {
  return html
    .replace(/\r/g, "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|blockquote|ul|ol|table|tr)>/gi, "\n\n")
    .replace(/<h2[^>]*>/gi, "## ")
    .replace(/<h3[^>]*>/gi, "### ")
    .replace(/<h4[^>]*>/gi, "#### ")
    .replace(/<blockquote[^>]*>\s*(<p[^>]*>)?/gi, "> ")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<(strong|b)[^>]*>/gi, "**")
    .replace(/<\/(strong|b)>/gi, "**")
    .replace(/<(em|i)[^>]*>/gi, "*")
    .replace(/<\/(em|i)>/gi, "*")
    .replace(/<code[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
