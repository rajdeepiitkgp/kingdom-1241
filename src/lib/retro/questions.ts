import type { UiKey } from "@/content/seed/ui-strings";
import { DEFAULT_SHOWN_RATINGS, type RatingKey, type RetroConfig, type TextKey } from "./config";

/**
 * The battle retrospective's question catalogue (pure, shared by the form, the
 * admin editor and the summary). The rules and the per-battle config live in
 * ./config.ts and are re-exported here.
 *
 * Questions are fixed in code so their wording is translated once and well,
 * and so results stay comparable from one battle to the next. What the council
 * decides per battle is which questions are shown and which are required
 * (`RetroConfig`, stored as JSON on the retrospective row). Ratings go from
 * 0 (very poor) to 5 (excellent); the three text prompts are capped at 500
 * characters so nobody writes an essay.
 */

export * from "./config";

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

const rating = (key: RatingKey, labelKey: UiKey, hintKey: UiKey): RatingQuestion => ({ key, labelKey, hintKey, defaultShown: DEFAULT_SHOWN_RATINGS.includes(key) });

/** In the order of `RATING_KEYS` (a test checks the two lists agree). */
export const RATING_QUESTIONS: readonly RatingQuestion[] = [
  rating("overall", "retro.q.overall", "retro.q.overall.hint"),
  rating("planning", "retro.q.planning", "retro.q.planning.hint"),
  rating("coordination", "retro.q.coordination", "retro.q.coordination.hint"),
  rating("formations", "retro.q.formations", "retro.q.formations.hint"),
  rating("timing", "retro.q.timing", "retro.q.timing.hint"),
  rating("language", "retro.q.language", "retro.q.language.hint"),
  rating("fairness", "retro.q.fairness", "retro.q.fairness.hint"),
  rating("teamwork", "retro.q.teamwork", "retro.q.teamwork.hint"),
];

export const TEXT_PROMPTS: readonly TextPrompt[] = [
  { key: "went_well", labelKey: "retro.t.wentWell", hintKey: "retro.t.wentWell.hint" },
  { key: "went_wrong", labelKey: "retro.t.wentWrong", hintKey: "retro.t.wentWrong.hint" },
  { key: "suggestions", labelKey: "retro.t.suggestions", hintKey: "retro.t.suggestions.hint" },
];

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
