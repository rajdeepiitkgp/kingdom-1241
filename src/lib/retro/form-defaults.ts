import { type NumberSchema, numberDefaults, parseNumbers } from "@/lib/config/numbers";
import { DEFAULT_MAX_RESPONSES, DEFAULT_RETENTION_DAYS, MAX_RESPONSES_LIMIT, RETENTION_RANGE } from "./questions";

/**
 * What a new battle feedback form starts with (pure; the owner's setting,
 * app_config "feedback_defaults"). Forms already created keep their own values.
 */

export type FeedbackDefaultKey = "retentionDays" | "maxResponses";
export type FeedbackDefaults = Record<FeedbackDefaultKey, number>;

export const FEEDBACK_DEFAULTS: NumberSchema<FeedbackDefaultKey> = {
  retentionDays: { min: RETENTION_RANGE.min, max: RETENTION_RANGE.max, default: DEFAULT_RETENTION_DAYS },
  maxResponses: { min: 1, max: MAX_RESPONSES_LIMIT, default: DEFAULT_MAX_RESPONSES },
};

export const DEFAULT_FEEDBACK_DEFAULTS: FeedbackDefaults = numberDefaults(FEEDBACK_DEFAULTS);

export function parseFeedbackDefaults(value: unknown): FeedbackDefaults {
  return parseNumbers(FEEDBACK_DEFAULTS, value);
}
