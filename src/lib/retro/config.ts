/**
 * The battle retrospective's rules and per-battle config (pure): the limits,
 * the question keys, and which questions a battle shows and requires
 * (`RetroConfig`, stored as JSON on the retrospective row). The questions'
 * texts live in ./questions.ts, which builds on this module; the data layer
 * and the actions need only what is here, so they never pull the catalogue
 * (and its interface-string keys) into pages that have no feedback form.
 */

export const RATING_MIN = 0;
export const RATING_MAX = 5;
export const TEXT_MAX = 500;
export const GAME_NAME_MAX = 40;
export const TITLE_MAX = 120;
export const INTRO_MAX = 5000;
export const DEFAULT_MAX_RESPONSES = 600;
export const MAX_RESPONSES_LIMIT = 2000;
export const DEFAULT_RETENTION_DAYS = 30;
export const RETENTION_RANGE = { min: 7, max: 365 } as const;

export type RatingKey = "overall" | "planning" | "coordination" | "formations" | "timing" | "language" | "fairness" | "teamwork";
export type TextKey = "went_well" | "went_wrong" | "suggestions";

/** Every rating, in the order the form shows them (the catalogue in ./questions.ts follows this list; a test checks). */
export const RATING_KEYS: readonly RatingKey[] = ["overall", "planning", "coordination", "formations", "timing", "language", "fairness", "teamwork"];
export const TEXT_KEYS: readonly TextKey[] = ["went_well", "went_wrong", "suggestions"];
/** Shown (and required) in a new retrospective; the others wait for the council to tick them. */
export const DEFAULT_SHOWN_RATINGS: readonly RatingKey[] = ["overall", "planning", "coordination", "formations"];

export function isRatingKey(value: unknown): value is RatingKey {
  return typeof value === "string" && (RATING_KEYS as readonly string[]).includes(value);
}

export function isTextKey(value: unknown): value is TextKey {
  return typeof value === "string" && (TEXT_KEYS as readonly string[]).includes(value);
}

export interface FieldSetting {
  shown: boolean;
  required: boolean;
}

export interface RetroConfig {
  ratings: Record<RatingKey, FieldSetting>;
  texts: Record<TextKey, FieldSetting>;
}

/** Four ratings shown and required, the three text prompts shown and optional (no pressure to write). */
export function defaultConfig(): RetroConfig {
  const ratings = {} as Record<RatingKey, FieldSetting>;
  for (const key of RATING_KEYS) {
    const shown = DEFAULT_SHOWN_RATINGS.includes(key);
    ratings[key] = { shown, required: shown };
  }
  const texts = {} as Record<TextKey, FieldSetting>;
  for (const key of TEXT_KEYS) texts[key] = { shown: true, required: false };
  return { ratings, texts };
}

function settingFrom(value: unknown, fallback: FieldSetting): FieldSetting {
  if (!value || typeof value !== "object") return fallback;
  const v = value as Record<string, unknown>;
  const shown = typeof v.shown === "boolean" ? v.shown : fallback.shown;
  const required = typeof v.required === "boolean" ? v.required : fallback.required;
  // A hidden question can't be required.
  return { shown, required: shown && required };
}

/** The stored JSON as a complete config: unknown keys are dropped, missing ones get their defaults. */
export function parseConfig(value: unknown): RetroConfig {
  const config = defaultConfig();
  if (!value || typeof value !== "object") return config;
  const v = value as Record<string, unknown>;
  const ratings = v.ratings && typeof v.ratings === "object" ? (v.ratings as Record<string, unknown>) : {};
  const texts = v.texts && typeof v.texts === "object" ? (v.texts as Record<string, unknown>) : {};
  for (const key of RATING_KEYS) if (key in ratings) config.ratings[key] = settingFrom(ratings[key], config.ratings[key]);
  for (const key of TEXT_KEYS) if (key in texts) config.texts[key] = settingFrom(texts[key], config.texts[key]);
  return config;
}

/** Field names of the admin form's checkboxes. */
export function configFieldName(kind: "rating" | "text", key: string, setting: keyof FieldSetting): string {
  return `${kind}.${key}.${setting}`;
}

function checked(fd: FormData, name: string): boolean {
  const value = fd.get(name);
  return value === "on" || value === "true" || value === "1";
}

/** The config an admin ticked in the editor (a hidden question is never required). */
export function configFromForm(fd: FormData): RetroConfig {
  const config = defaultConfig();
  for (const key of RATING_KEYS) {
    const shown = checked(fd, configFieldName("rating", key, "shown"));
    config.ratings[key] = { shown, required: shown && checked(fd, configFieldName("rating", key, "required")) };
  }
  for (const key of TEXT_KEYS) {
    const shown = checked(fd, configFieldName("text", key, "shown"));
    config.texts[key] = { shown, required: shown && checked(fd, configFieldName("text", key, "required")) };
  }
  return config;
}

/** The ratings a battle shows, in form order. */
export function shownRatingKeys(config: RetroConfig): RatingKey[] {
  return RATING_KEYS.filter((key) => config.ratings[key].shown);
}

/** The text prompts a battle shows, in form order. */
export function shownTextKeys(config: RetroConfig): TextKey[] {
  return TEXT_KEYS.filter((key) => config.texts[key].shown);
}
