import { parsePasswordRules, type PasswordRules } from "@/lib/kvk/password-rules";
import { createLogger } from "@/lib/log";
import { type FeedbackDefaults, parseFeedbackDefaults } from "@/lib/retro/form-defaults";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { parseTranslationSettings, type TranslationSettings } from "@/lib/translate/pause";
import { type ConfigKey, readConfig } from "./app-config";

/**
 * The owner's settings as the rest of the site reads them (server only,
 * uncached: one small query where it matters). Never throws: without a
 * database, before migration 0016, or when the read fails, every setting is
 * its default, so a settings problem can't take a page or a form down.
 */

const log = createLogger("config");

async function setting(key: ConfigKey): Promise<unknown> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    return await readConfig(createAdminClient(), key);
  } catch (error) {
    log.warn("Could not read a setting, using its defaults", { key, error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return null;
  }
}

export async function getTranslationSettings(): Promise<TranslationSettings> {
  return parseTranslationSettings(await setting("translation"));
}

export async function getPasswordRules(): Promise<PasswordRules> {
  return parsePasswordRules(await setting("password_rules"));
}

export async function getFeedbackDefaults(): Promise<FeedbackDefaults> {
  return parseFeedbackDefaults(await setting("feedback_defaults"));
}
