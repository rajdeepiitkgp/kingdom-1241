import { DEFAULT_LOCALE } from "./languages";

/**
 * Every translatable field is stored as a map of language code → text.
 * English (`en`) is the source language and is always present.
 */
export type Localized = Record<string, string>;

/**
 * Pick the text for a locale, falling back to English, then to any value.
 * Returns an empty string when the field is empty or missing.
 */
export function pick(value: Localized | null | undefined, locale: string): string {
  if (!value) return "";
  const direct = value[locale];
  if (typeof direct === "string" && direct.trim() !== "") return direct;
  const fallback = value[DEFAULT_LOCALE];
  if (typeof fallback === "string" && fallback.trim() !== "") return fallback;
  for (const text of Object.values(value)) {
    if (typeof text === "string" && text.trim() !== "") return text;
  }
  return "";
}

/** True when the locale has its own translation (not a fallback). */
export function hasTranslation(value: Localized | null | undefined, locale: string): boolean {
  const text = value?.[locale];
  return typeof text === "string" && text.trim() !== "";
}

/** Build a Localized value from an English string. */
export function en(text: string): Localized {
  return { [DEFAULT_LOCALE]: text };
}
