/**
 * Language registry.
 *
 * The list of languages the site *offers*, in which order, lives in the
 * database (`languages` table; the owner shows, hides and orders them on
 * Admin → Settings). This file is the catalogue of languages the site *knows
 * how to render*: names, text direction, font stack and translation style.
 * Adding a language is a code change: an entry here, a seed row with
 * `enabled: false`, its glossary words and a reviewed translation before it is
 * shown (SETUP.md § 8.2a).
 */

export type TextDirection = "ltr" | "rtl";

/** Which font stack the layout applies (see `--font-*` in globals.css). CJK stacks use the device's fonts. */
export type FontStack = "latin" | "korean" | "arabic" | "japanese" | "chinese";

export interface LanguageInfo {
  /** BCP-47 code used in URLs, e.g. "en", "de", "pt-BR". */
  code: string;
  /** English name, used for admin screens and translation prompts. */
  name: string;
  /** Name in the language itself, shown in the language switcher. */
  nativeName: string;
  direction: TextDirection;
  font: FontStack;
  /** Emoji flag shown next to the native name. Purely decorative. */
  flag: string;
  /** Style rule for the translation prompt, where the general one doesn't fit this language. */
  style?: string;
}

export const LANGUAGE_REGISTRY: Record<string, LanguageInfo> = {
  en: { code: "en", name: "English", nativeName: "English", direction: "ltr", font: "latin", flag: "🇬🇧" },
  de: { code: "de", name: "German", nativeName: "Deutsch", direction: "ltr", font: "latin", flag: "🇩🇪" },
  ko: { code: "ko", name: "Korean", nativeName: "한국어", direction: "ltr", font: "korean", flag: "🇰🇷" },
  pl: { code: "pl", name: "Polish", nativeName: "Polski", direction: "ltr", font: "latin", flag: "🇵🇱" },
  ar: { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl", font: "arabic", flag: "🇸🇦" },
  // Ready to be switched on later by adding a row to the `languages` table.
  fr: { code: "fr", name: "French", nativeName: "Français", direction: "ltr", font: "latin", flag: "🇫🇷" },
  es: { code: "es", name: "Spanish", nativeName: "Español", direction: "ltr", font: "latin", flag: "🇪🇸" },
  it: { code: "it", name: "Italian", nativeName: "Italiano", direction: "ltr", font: "latin", flag: "🇮🇹" },
  pt: { code: "pt", name: "Portuguese", nativeName: "Português", direction: "ltr", font: "latin", flag: "🇵🇹" },
  tr: { code: "tr", name: "Turkish", nativeName: "Türkçe", direction: "ltr", font: "latin", flag: "🇹🇷" },
  ru: { code: "ru", name: "Russian", nativeName: "Русский", direction: "ltr", font: "latin", flag: "🇷🇺" },
  uk: { code: "uk", name: "Ukrainian", nativeName: "Українська", direction: "ltr", font: "latin", flag: "🇺🇦" },
  nl: { code: "nl", name: "Dutch", nativeName: "Nederlands", direction: "ltr", font: "latin", flag: "🇳🇱" },
  vi: { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", direction: "ltr", font: "latin", flag: "🇻🇳" },
  id: { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", direction: "ltr", font: "latin", flag: "🇮🇩" },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    direction: "ltr",
    font: "japanese",
    flag: "🇯🇵",
    style: "Use the polite です/ます form throughout (instead of the informal register), with no casual endings such as ね or よ.",
  },
  "zh-TW": {
    code: "zh-TW",
    name: "Chinese (Traditional)",
    nativeName: "繁體中文",
    direction: "ltr",
    font: "chinese",
    flag: "🇹🇼",
    style: "Use Traditional Chinese as written in Taiwan.",
  },
  "zh-CN": { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文", direction: "ltr", font: "chinese", flag: "🇨🇳" },
  he: { code: "he", name: "Hebrew", nativeName: "עברית", direction: "rtl", font: "latin", flag: "🇮🇱" },
  fa: { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl", font: "arabic", flag: "🇮🇷" },
};

/** The language every piece of content is authored in and falls back to. */
export const DEFAULT_LOCALE = "en";

/** Cookie that remembers the visitor's chosen language. */
export const LOCALE_COOKIE = "kd1241_lang";

export function getLanguageInfo(code: string): LanguageInfo {
  return (
    LANGUAGE_REGISTRY[code] ?? {
      code,
      name: code,
      nativeName: code,
      direction: "ltr",
      font: "latin",
      flag: "🌐",
    }
  );
}

/** A language this file knows (shown or hidden on the site). */
export function isKnownLanguage(code: string): boolean {
  return Object.hasOwn(LANGUAGE_REGISTRY, code);
}

/** Shape of a locale code the site accepts in forms and paths: "en", "pt-BR", "zh-Hant" (not whether it is enabled). */
export function isLocaleCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value);
}

/** A language as configured by admins (database row), merged with registry info. */
export interface SiteLanguage extends LanguageInfo {
  enabled: boolean;
  sortOrder: number;
}
