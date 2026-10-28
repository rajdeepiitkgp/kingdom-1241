import { isOwnerIdentity, type OwnerKind, ownerLabel, parseOwners } from "@/lib/auth/owner";
import { checkOwner } from "@/lib/auth/server";
import { getFeedbackDefaults, getPasswordRules, getTranslationSettings } from "@/lib/config/settings";
import { getLanguageInfo } from "@/lib/i18n/languages";
import type { PasswordRules } from "@/lib/kvk/password-rules";
import { createLogger } from "@/lib/log";
import { ACTIVE_BROWSER_MS, type Capacity, CAPACITY_MODES, type CapacityUsage, DEFAULT_CAPACITY } from "@/lib/rally-sync/capacity";
import { isRoomOpen, type RoomMode } from "@/lib/rally-sync/room";
import { roomCapacity } from "@/lib/rally-sync/session";
import { rallyStore } from "@/lib/rally-sync/store";
import type { FeedbackDefaults } from "@/lib/retro/form-defaults";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import type { TranslationSettings } from "@/lib/translate/pause";
import { isTranslationConfigured, translationProviderLabel } from "@/lib/translate/provider";
import { TRANSLATABLE_TABLES } from "@/lib/translate/tables";
import { addCoverage, type TextCoverage } from "./languages";

/**
 * Uncached reads for the owner's settings page (server only). Nothing without
 * the owner's session: the page checks first, and so does this module.
 */

const log = createLogger("admin");

/** One entry of SITE_OWNER as configured (production holds exactly one: the Discord user id), shown in part only. */
export interface OwnerEntry {
  kind: OwnerKind;
  shown: string;
  /** The account signed in now. */
  you: boolean;
  /** Its Discord handle, when it is the account signed in now (the page names it by that, not the number). */
  handle: string | null;
}

export interface RallyCapacitySettings {
  /** False without a database, or when it can't be read. */
  available: boolean;
  capacity: Capacity;
  /** What is open right now, per type. */
  usage: Record<RoomMode, CapacityUsage>;
}

export interface OwnerLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  shown: boolean;
  /** English texts not translated into it yet (0 for English). */
  missing: number;
}

export interface LanguageSettings {
  /** False without a database, or when it can't be read. */
  available: boolean;
  /** In the switcher's order, shown and hidden. */
  languages: OwnerLanguage[];
  /** English texts across the site, for "12 of 1,040 not translated". */
  texts: number;
}

export interface MachineTranslation extends TranslationSettings {
  /** A provider key is set (else translation is off whatever the switch says). */
  configured: boolean;
  label: string;
}

export interface OwnerSettings {
  owners: OwnerEntry[];
  rally: RallyCapacitySettings;
  languages: LanguageSettings;
  translation: MachineTranslation;
  passwordRules: PasswordRules;
  feedbackDefaults: FeedbackDefaults;
}

export async function getOwnerSettings(): Promise<OwnerSettings | null> {
  const access = await checkOwner();
  if ("denied" in access) {
    log.warn("Owner settings requested without access", { reason: access.denied });
    return null;
  }
  const owners: OwnerEntry[] = parseOwners(process.env.SITE_OWNER).map((owner) => {
    const you = isOwnerIdentity(access.user, owner);
    return { ...ownerLabel(owner), you, handle: you ? access.user.discordUsername : null };
  });
  const [rally, languages, translation, passwordRules, feedbackDefaults, label] = await Promise.all([
    rallyCapacitySettings(),
    languageSettings(),
    getTranslationSettings(),
    getPasswordRules(),
    getFeedbackDefaults(),
    translationProviderLabel(),
  ]);
  return { owners, rally, languages, translation: { ...translation, configured: isTranslationConfigured(), label }, passwordRules, feedbackDefaults };
}

/** Every language row (shown and hidden) with how much of the site is translated into it; reads only the translatable columns. */
async function languageSettings(): Promise<LanguageSettings> {
  if (!isSupabaseAdminConfigured()) return { available: false, languages: [], texts: 0 };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("languages").select("code, enabled, sort_order").order("sort_order").order("code");
    if (error) throw error;
    const rows = (data ?? []) as Array<{ code: string; enabled: boolean }>;
    const others = rows.map((row) => row.code).filter((code) => code !== "en");
    const tables = await Promise.all(
      TRANSLATABLE_TABLES.map(async (table) => {
        const columns = table.columns.map((column) => column.name);
        const result = await admin.from(table.table).select(columns.join(", "));
        if (result.error) throw result.error;
        return { rows: (result.data ?? []) as unknown as Array<Record<string, unknown>>, columns };
      }),
    );
    const coverage = tables.reduce<TextCoverage>((sum, table) => addCoverage(sum, table.rows, table.columns, others), { total: 0, missing: {} });
    return {
      available: true,
      texts: coverage.total,
      languages: rows.map((row) => {
        const info = getLanguageInfo(row.code);
        return { code: row.code, name: info.name, nativeName: info.nativeName, flag: info.flag, shown: row.enabled !== false, missing: coverage.missing[row.code] ?? 0 };
      }),
    };
  } catch (error) {
    log.error("Could not read the languages", { error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return { available: false, languages: [], texts: 0 };
  }
}

function noUsage(): Record<RoomMode, CapacityUsage> {
  return Object.fromEntries(CAPACITY_MODES.map((mode) => [mode, { rooms: 0, browsers: 0, leaders: 0 }])) as Record<RoomMode, CapacityUsage>;
}

async function rallyCapacitySettings(): Promise<RallyCapacitySettings> {
  const store = rallyStore();
  if (!store) return { available: false, capacity: DEFAULT_CAPACITY, usage: noUsage() };
  try {
    const now = Date.now();
    const [rooms, capacity] = await Promise.all([store.listRooms(), roomCapacity(store)]);
    const open = rooms.filter((room) => isRoomOpen(room, now));
    const ids = open.map((room) => room.id);
    const [browsers, leaders] = await Promise.all([store.activeInstanceCounts(ids, now - ACTIVE_BROWSER_MS), store.leaderCounts(ids)]);
    const usage = noUsage();
    for (const room of open) {
      usage[room.mode].rooms += 1;
      usage[room.mode].browsers += browsers.get(room.id) ?? 0;
      usage[room.mode].leaders += leaders.get(room.id) ?? 0;
    }
    return { available: true, capacity, usage };
  } catch (error) {
    log.error("Could not read the Rally Sync usage", { error: error instanceof Error ? error.message : String(error) });
    return { available: false, capacity: DEFAULT_CAPACITY, usage: noUsage() };
  }
}
