// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * The owner's brake on machine translation (pure; app_config "translation").
 * While paused, the webhook only refreshes the cache, `npm run translate`
 * refuses to run and the feedback AI buttons are off; texts edited meanwhile
 * show in English in the other languages until a translate run after resuming.
 */
export interface TranslationSettings {
  paused: boolean;
  /** When it was paused (ISO), for the settings page. */
  since: string | null;
}

export const TRANSLATION_RUNNING: TranslationSettings = { paused: false, since: null };

export function parseTranslationSettings(value: unknown): TranslationSettings {
  if (typeof value !== "object" || value === null) return TRANSLATION_RUNNING;
  const stored = value as Record<string, unknown>;
  if (stored.paused !== true) return TRANSLATION_RUNNING;
  return { paused: true, since: typeof stored.since === "string" ? stored.since : null };
}

export const PAUSED_MESSAGE = "Machine translation is paused (Admin → Settings).";
