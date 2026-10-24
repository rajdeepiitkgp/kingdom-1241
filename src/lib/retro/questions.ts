import type { UiKey } from "@/content/seed/ui-strings";

/**
 * The battle retrospective's question catalogue (pure, shared by the form, the
 * admin editor and the summary).
 *
 * Questions are fixed in code so their wording is translated once and well,
 * and so results stay comparable from one battle to the next. What the council
 * decides per battle is which questions are shown and which are required
 * (`RetroConfig`, stored as JSON on the retrospective row). Ratings go from
 * 0 (very poor) to 5 (excellent); the three text prompts are capped at 500
 * characters so nobody writes an essay.
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

export interface RatingQuestion {
  key: RatingKey;
  labelKey: UiKey;
  hintKey: UiKey;
  /** Shown (and required) in a new retrospective. */
  defaultShown: boolean;
}

export interface TextPrompt {
  key: TextKey;
  labelKey: UiKey;
  hintKey: UiKey;
}

export const RATING_QUESTIONS: readonly RatingQuestion[] = [
  { key: "overall", labelKey: "retro.q.overall", hintKey: "retro.q.overall.hint", defaultShown: true },
  { key: "planning", labelKey: "retro.q.planning", hintKey: "retro.q.planning.hint", defaultShown: true },
  { key: "coordination", labelKey: "retro.q.coordination", hintKey: "retro.q.coordination.hint", defaultShown: true },
  { key: "formations", labelKey: "retro.q.formations", hintKey: "retro.q.formations.hint", defaultShown: true },
  { key: "timing", labelKey: "retro.q.timing", hintKey: "retro.q.timing.hint", defaultShown: false },
  { key: "language", labelKey: "retro.q.language", hintKey: "retro.q.language.hint", defaultShown: false },
  { key: "fairness", labelKey: "retro.q.fairness", hintKey: "retro.q.fairness.hint", defaultShown: false },
  { key: "teamwork", labelKey: "retro.q.teamwork", hintKey: "retro.q.teamwork.hint", defaultShown: false },
];

export const TEXT_PROMPTS: readonly TextPrompt[] = [
  { key: "went_well", labelKey: "retro.t.wentWell", hintKey: "retro.t.wentWell.hint" },
  { key: "went_wrong", labelKey: "retro.t.wentWrong", hintKey: "retro.t.wentWrong.hint" },
  { key: "suggestions", labelKey: "retro.t.suggestions", hintKey: "retro.t.suggestions.hint" },
];

export const RATING_KEYS: readonly RatingKey[] = RATING_QUESTIONS.map((q) => q.key);
export const TEXT_KEYS: readonly TextKey[] = TEXT_PROMPTS.map((t) => t.key);

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
  for (const q of RATING_QUESTIONS) ratings[q.key] = { shown: q.defaultShown, required: q.defaultShown };
  const texts = {} as Record<TextKey, FieldSetting>;
  for (const t of TEXT_PROMPTS) texts[t.key] = { shown: true, required: false };
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

export function shownRatings(config: RetroConfig): RatingQuestion[] {
  return RATING_QUESTIONS.filter((q) => config.ratings[q.key].shown);
}

export function shownTexts(config: RetroConfig): TextPrompt[] {
  return TEXT_PROMPTS.filter((t) => config.texts[t.key].shown);
}

/** A config that would show no question at all is useless; the editor refuses it. */
export function configProblem(config: RetroConfig): string | null {
  if (shownRatings(config).length === 0 && shownTexts(config).length === 0) return "Show at least one question or text prompt.";
  return null;
}
