import { type AllianceSyncState, NO_SYNC_YET, parseAllianceSyncState } from "@/lib/alliances/sync-plan";
import { isOwnerIdentity, type OwnerKind, ownerLabel, parseOwners } from "@/lib/auth/owner";
import { checkOwner, type CurrentUser } from "@/lib/auth/server";
import { readConfig } from "@/lib/config/app-config";
import { getFeedbackDefaults, getPasswordRules, getTranslationSettings } from "@/lib/config/settings";
import { getLanguageInfo } from "@/lib/i18n/languages";
import type { PasswordRules } from "@/lib/kvk/password-rules";
import { createLogger } from "@/lib/log";
import { ACTIVE_BROWSER_MS, type Capacity, CAPACITY_MODES, type CapacityUsage, DEFAULT_CAPACITY } from "@/lib/rally-sync/capacity";
import { isRoomOpen, type RoomMode } from "@/lib/rally-sync/room";
import { roomCapacity } from "@/lib/rally-sync/session";
import { rallyStore } from "@/lib/rally-sync/store";
import type { FeedbackDefaults } from "@/lib/retro/form-defaults";
import { mightPulseConfigured } from "@/lib/retro/mightpulse";
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

/** One alliance on the list (the `alliances` table: what Home shows). */
export interface OwnerAlliance {
  id: string;
  tag: string;
  name: string;
  color: string;
  power: number | null;
  leader: string | null;
  members: number | null;
  published: boolean;
  /** MightPulse's alliance id; null until the first sync links it by its tag. */
  aid: number | null;
  source: "seed" | "mightpulse" | "manual";
  statsAt: string | null;
}

export interface AllianceSettings {
  /** False without a database, or when it can't be read. */
  available: boolean;
  /** False until migration 0017 is applied. */
  migrated: boolean;
  /** MIGHTPULSE_API_KEY is set. */
  configured: boolean;
  alliances: OwnerAlliance[];
  sync: AllianceSyncState;
}

/** The General tab: who the owner is, and the small switches. */
export interface GeneralSettings {
  owners: OwnerEntry[];
  translation: MachineTranslation;
  passwordRules: PasswordRules;
  feedbackDefaults: FeedbackDefaults;
}

/** One tab's data for the owner only (null for anyone else): each tab of the page loads just what it shows. */
async function forOwner<T>(tab: string, load: (user: CurrentUser) => Promise<T>): Promise<T | null> {
  const access = await checkOwner();
  if ("denied" in access) {
    log.warn("Owner settings requested without access", { tab, reason: access.denied });
    return null;
  }
  return load(access.user);
}

export function getGeneralSettings(): Promise<GeneralSettings | null> {
  return forOwner("general", async (user) => {
    const owners: OwnerEntry[] = parseOwners(process.env.SITE_OWNER).map((owner) => {
      const you = isOwnerIdentity(user, owner);
      return { ...ownerLabel(owner), you, handle: you ? user.discordUsername : null };
    });
    const [translation, passwordRules, feedbackDefaults, label] = await Promise.all([getTranslationSettings(), getPasswordRules(), getFeedbackDefaults(), translationProviderLabel()]);
    return { owners, translation: { ...translation, configured: isTranslationConfigured(), label }, passwordRules, feedbackDefaults };
  });
}

export const getRallyCapacitySettings = () => forOwner("rally-sync", rallyCapacitySettings);
export const getAllianceSettings = () => forOwner("alliances", allianceSettings);
export const getLanguageSettings = () => forOwner("languages", languageSettings);

const SOURCES = new Set(["seed", "mightpulse", "manual"]);

/** Every alliance on the list, strongest first (Home's order), with the last sync and its ranking. */
async function allianceSettings(): Promise<AllianceSettings> {
  const configured = mightPulseConfigured();
  const none = { alliances: [], sync: NO_SYNC_YET, configured };
  if (!isSupabaseAdminConfigured()) return { available: false, migrated: true, ...none };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("alliances")
    .select("id, tag, name, color, power, leader, members, published, mightpulse_aid, stats_source, stats_at")
    .order("power", { ascending: false, nullsFirst: false })
    .order("sort_order");
  if (error) {
    if (error.code === "42703") return { available: true, migrated: false, ...none };
    log.error("Could not read the alliances", { error: error.message });
    return { available: false, migrated: true, ...none };
  }
  let sync = NO_SYNC_YET;
  try {
    sync = parseAllianceSyncState(await readConfig(admin, "alliance_sync"));
  } catch (configError) {
    log.warn("Could not read the last alliance sync", { error: configError instanceof Error ? configError.message : String(configError) });
  }
  const alliances = (data ?? []).map(
    (row): OwnerAlliance => ({
      id: row.id,
      tag: row.tag,
      name: row.name,
      color: row.color,
      power: typeof row.power === "number" ? row.power : null,
      leader: row.leader ?? null,
      members: typeof row.members === "number" ? row.members : null,
      published: row.published !== false,
      aid: typeof row.mightpulse_aid === "number" ? row.mightpulse_aid : null,
      source: SOURCES.has(row.stats_source) ? row.stats_source : "seed",
      statsAt: row.stats_at ?? null,
    }),
  );
  return { available: true, migrated: true, configured, alliances, sync };
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
