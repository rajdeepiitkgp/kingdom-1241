"use server";

import { revalidatePath, updateTag } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkOwner, type CurrentUser } from "@/lib/auth/server";
import { type ConfigKey, readConfig, writeConfig } from "@/lib/config/app-config";
import { parseNumberForm } from "@/lib/config/numbers";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { parsePasswordRules, parsePasswordRulesForm } from "@/lib/kvk/password-rules";
import type { Logger } from "@/lib/log";
import { parseCapacityForm } from "@/lib/rally-sync/capacity";
import { roomCapacity } from "@/lib/rally-sync/session";
import { RallyStoreError, rallyStore } from "@/lib/rally-sync/store";
import { FEEDBACK_DEFAULTS, parseFeedbackDefaults } from "@/lib/retro/form-defaults";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { parseTranslationSettings, TRANSLATION_RUNNING, type TranslationSettings } from "@/lib/translate/pause";
import { actionLogger, denied, failed, INVALID_FIELDS, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField, textField } from "./forms";
import { hasLanguageChanges, languageChanges, parseLanguageForm, savedLanguagesMessage } from "./languages";

/**
 * Server Actions of the owner's settings page. Every one re-checks that the
 * caller is the owner (the page and its link are the owner's only, but an
 * action can be POSTed directly) and writes an audit entry with the old and
 * new values.
 */

const OWNER_ONLY = "Only the owner can change the settings.";
const NO_DATABASE: ActionState = { status: "error", message: "The settings need the database." };

function settingsPath(formData: FormData): string {
  return adminPath(localeField(formData), "/settings");
}

/** Writes one app_config value and audits it with the value before; `parse` reads the stored one as the site does. */
async function saveConfig(user: CurrentUser, key: ConfigKey, value: unknown, parse: (stored: unknown) => unknown, log: Logger, formData: FormData): Promise<ActionState | null> {
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  try {
    const admin = createAdminClient();
    const before = parse(await readConfig(admin, key));
    await writeConfig(admin, key, value);
    await audit(user, "config.update", "app_config", key, { before, after: value });
    log.info("Setting saved", { key });
    revalidatePath(settingsPath(formData));
    return null;
  } catch (error) {
    return failed(log, `Saving ${key}`, { message: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
  }
}

export async function saveRallyCapacity(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkOwner();
  if ("denied" in access) return denied(access.denied, OWNER_ONLY);
  const log = await actionLogger();
  const parsed = parseCapacityForm(formData);
  if (!parsed.ok) return invalid(parsed.errors, parsed.message ?? INVALID_FIELDS);
  const store = rallyStore();
  if (!store) return { status: "error", message: "Rally Sync needs the database." };
  try {
    const before = await roomCapacity(store);
    await store.writeCapacity(parsed.value);
    if (store.kind === "supabase") await audit(access.user, "config.update", "app_config", "rally_sync_capacity", { before, after: parsed.value });
    log.info("Rally Sync limits saved");
    updateTag(CACHE_TAGS.config);
    const locale = localeField(formData);
    revalidatePath(adminPath(locale, "/settings"));
    revalidatePath(adminPath(locale, "/rally-sync"));
    return { status: "saved", message: "Saved. The new limits apply from now on." };
  } catch (error) {
    if (error instanceof RallyStoreError && error.problem === "not_migrated") {
      return { status: "error", message: "The database doesn't have the settings table yet (migration 0016). Try again once the deploy has finished." };
    }
    return failed(log, "Saving the Rally Sync limits", { message: error instanceof Error ? error.message : String(error) });
  }
}

// ---------------------------------------------------------------------------
// Languages: shown or hidden, and their order (adding one is a code change)
// ---------------------------------------------------------------------------

export async function saveLanguages(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkOwner();
  if ("denied" in access) return denied(access.denied, OWNER_ONLY);
  const log = await actionLogger();
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const admin = createAdminClient();
  const { data, error } = await admin.from("languages").select("code, enabled, sort_order").order("sort_order").order("code");
  if (error) return failed(log, "Reading the languages", error);
  const rows = (data ?? []) as Array<{ code: string; enabled: boolean; sort_order: number }>;
  const parsed = parseLanguageForm(
    formData,
    rows.map((row) => row.code),
  );
  if (!parsed.ok) return { status: "error", message: parsed.message };
  const before = rows.map((row) => ({ code: row.code, shown: row.enabled }));
  const changes = languageChanges(before, parsed.value);
  if (!hasLanguageChanges(changes)) return { status: "saved", message: "Nothing to save: the list is as it was." };
  // One row at a time, like the other ▲ ▼ lists; only the rows whose place or state changed.
  for (const [index, row] of parsed.value.entries()) {
    const stored = rows.find((candidate) => candidate.code === row.code);
    if (stored?.sort_order === index && stored.enabled === row.shown) continue;
    const { error: writeError } = await admin.from("languages").update({ sort_order: index, enabled: row.shown }).eq("code", row.code);
    if (writeError) return failed(log, "Saving the languages", writeError);
  }
  await audit(access.user, "languages.update", "languages", null, { before, after: parsed.value });
  log.info("Languages saved", { shown: changes.shown.length, hidden: changes.hidden.length, moved: changes.moved });
  // Every page shows the language menu: this one expiry renders the site again.
  updateTag(CACHE_TAGS.languages);
  revalidatePath(settingsPath(formData));
  return { status: "saved", message: savedLanguagesMessage(changes) };
}

// ---------------------------------------------------------------------------
// Machine translation, wrong-password rules, feedback defaults (app_config)
// ---------------------------------------------------------------------------

export async function saveTranslationPause(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkOwner();
  if ("denied" in access) return denied(access.denied, OWNER_ONLY);
  const log = await actionLogger();
  const paused = textField(formData, "paused") === "1";
  const value: TranslationSettings = paused ? { paused: true, since: new Date().toISOString() } : TRANSLATION_RUNNING;
  const problem = await saveConfig(access.user, "translation", value, parseTranslationSettings, log, formData);
  if (problem) return problem;
  return {
    status: "saved",
    message: paused
      ? "Machine translation is paused. Edited texts show in English in the other languages until it runs again."
      : "Machine translation runs again. Run Maintenance → translate once to fill in what was edited while it was paused.",
  };
}

export async function savePasswordRules(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkOwner();
  if ("denied" in access) return denied(access.denied, OWNER_ONLY);
  const log = await actionLogger();
  const parsed = parsePasswordRulesForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const problem = await saveConfig(access.user, "password_rules", parsed.value, parsePasswordRules, log, formData);
  return problem ?? { status: "saved", message: "Saved. The new rules count from the next wrong password." };
}

export async function saveFeedbackDefaults(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkOwner();
  if ("denied" in access) return denied(access.denied, OWNER_ONLY);
  const log = await actionLogger();
  const parsed = parseNumberForm(FEEDBACK_DEFAULTS, formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const problem = await saveConfig(access.user, "feedback_defaults", parsed.value, parseFeedbackDefaults, log, formData);
  return problem ?? { status: "saved", message: "Saved. New feedback forms start with these; existing ones keep their own." };
}
