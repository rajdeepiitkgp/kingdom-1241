import { cacheLife, cacheTag } from "next/cache";
import { buildSeedContent, SEED_LANGUAGES, SEED_SETTINGS } from "@/content/seed";
import { getLanguageInfo, type SiteLanguage } from "@/lib/i18n/languages";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import {
  mapAlliance,
  mapAnnouncement,
  mapEvent,
  mapGiftCode,
  mapGuide,
  mapHero,
  mapKvkPlan,
  mapRule,
  mapRuleTopic,
  mapSettings,
  mapUiString,
} from "./mappers";
import type {
  Alliance,
  Announcement,
  GameEvent,
  GiftCode,
  Guide,
  Hero,
  KvkPlanWithSecret,
  RuleTopic,
  SiteSettings,
  UiString,
} from "./types";

/**
 * Content loaders used by the pages.
 *
 * Every loader is a `use cache` function: the result is part of the
 * prerendered page, refreshed in the background every few minutes
 * (`cacheLife('content')`, see next.config.ts) and invalidated immediately when
 * the translation pipeline or `/api/revalidate` calls `revalidateTag`.
 *
 * When Supabase isn't configured (first local run, preview without env vars)
 * the loaders return the bundled seed content so the site still works.
 */

export const CACHE_TAGS = {
  all: "content",
  languages: "content:languages",
  settings: "content:site_settings",
  uiStrings: "content:ui_strings",
  announcements: "content:announcements",
  events: "content:events",
  rules: "content:rules",
  guides: "content:guides",
  alliances: "content:alliances",
  giftCodes: "content:gift_codes",
  heroes: "content:heroes",
  kvk: "content:kvk",
} as const;

/** Map a table name (as used by Supabase webhooks) to its cache tag. */
export function cacheTagForTable(table: string): string | null {
  switch (table) {
    case "languages":
      return CACHE_TAGS.languages;
    case "site_settings":
      return CACHE_TAGS.settings;
    case "ui_strings":
      return CACHE_TAGS.uiStrings;
    case "announcements":
      return CACHE_TAGS.announcements;
    case "events":
      return CACHE_TAGS.events;
    case "rule_topics":
    case "rules":
      return CACHE_TAGS.rules;
    case "guides":
      return CACHE_TAGS.guides;
    case "alliances":
      return CACHE_TAGS.alliances;
    case "gift_codes":
      return CACHE_TAGS.giftCodes;
    case "heroes":
      return CACHE_TAGS.heroes;
    case "kvk_plans":
    case "kvk_rules":
    case "kvk_coordinators":
    case "kvk_formations":
      return CACHE_TAGS.kvk;
    default:
      return null;
  }
}

/** Drop rows whose `expiresAt` is in the past (evaluated when the cache entry is built). */
function dropExpired<T extends { expiresAt: string | null }>(rows: T[]): T[] {
  const now = Date.now();
  return rows.filter((row) => !row.expiresAt || Date.parse(row.expiresAt) > now);
}

const log = createLogger("data");

function logFallback(what: string, error: unknown) {
  log.error("Failed to load from Supabase, using seed content instead", { what, error });
}

// ---------------------------------------------------------------------------
// Languages & settings
// ---------------------------------------------------------------------------

function seedLanguages(): SiteLanguage[] {
  return SEED_LANGUAGES.map((l) => ({ ...getLanguageInfo(l.code), enabled: l.enabled, sortOrder: l.sortOrder }));
}

export async function getLanguages(): Promise<SiteLanguage[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.languages);

  if (!isSupabaseConfigured()) return seedLanguages();
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase
      .from("languages")
      .select("code, enabled, sort_order")
      .eq("enabled", true)
      .order("sort_order");
    if (error) throw error;
    if (!data || data.length === 0) return seedLanguages();
    return data.map((row) => ({
      ...getLanguageInfo(row.code),
      enabled: row.enabled !== false,
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
    }));
  } catch (error) {
    logFallback("languages", error);
    return seedLanguages();
  }
}

export async function getEnabledLocales(): Promise<string[]> {
  const languages = await getLanguages();
  return languages.filter((l) => l.enabled).map((l) => l.code);
}

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.settings);

  if (!isSupabaseConfigured()) return SEED_SETTINGS;
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase.from("site_settings").select("key, value");
    if (error) throw error;
    return mapSettings(data ?? [], SEED_SETTINGS);
  } catch (error) {
    logFallback("settings", error);
    return SEED_SETTINGS;
  }
}

export async function getUiStrings(): Promise<UiString[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.uiStrings);

  if (!isSupabaseConfigured()) return buildSeedContent().uiStrings;
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase.from("ui_strings").select("key, text");
    if (error) throw error;
    if (!data || data.length === 0) return buildSeedContent().uiStrings;
    return data.map(mapUiString);
  } catch (error) {
    logFallback("ui strings", error);
    return buildSeedContent().uiStrings;
  }
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export async function getAnnouncements(): Promise<Announcement[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.announcements);

  if (!isSupabaseConfigured()) return dropExpired(buildSeedContent().announcements);
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("published", true)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return dropExpired((data ?? []).map(mapAnnouncement));
  } catch (error) {
    logFallback("announcements", error);
    return dropExpired(buildSeedContent().announcements);
  }
}

export async function getEvents(): Promise<GameEvent[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.events);

  if (!isSupabaseConfigured()) return buildSeedContent().events;
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase.from("events").select("*").eq("published", true).order("starts_at");
    if (error) throw error;
    return (data ?? []).map(mapEvent);
  } catch (error) {
    logFallback("events", error);
    return buildSeedContent().events;
  }
}

export async function getRuleTopics(): Promise<RuleTopic[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.rules);

  if (!isSupabaseConfigured()) return buildSeedContent().ruleTopics;
  try {
    const supabase = createPublicClient()!;
    const [topics, rules] = await Promise.all([
      supabase.from("rule_topics").select("*").eq("published", true).order("sort_order"),
      supabase.from("rules").select("*").eq("published", true).order("sort_order"),
    ]);
    if (topics.error) throw topics.error;
    if (rules.error) throw rules.error;
    const mappedRules = (rules.data ?? []).map(mapRule);
    return (topics.data ?? []).map((row) => mapRuleTopic(row, mappedRules));
  } catch (error) {
    logFallback("rules", error);
    return buildSeedContent().ruleTopics;
  }
}

export async function getGuides(): Promise<Guide[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.guides);

  if (!isSupabaseConfigured()) return buildSeedContent().guides;
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase.from("guides").select("*").eq("published", true).order("sort_order");
    if (error) throw error;
    return (data ?? []).map(mapGuide);
  } catch (error) {
    logFallback("guides", error);
    return buildSeedContent().guides;
  }
}

export async function getGuideBySlug(slug: string): Promise<Guide | null> {
  const guides = await getGuides();
  return guides.find((g) => g.slug === slug) ?? null;
}

export async function getAlliances(): Promise<Alliance[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.alliances);

  if (!isSupabaseConfigured()) return buildSeedContent().alliances;
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase.from("alliances").select("*").eq("published", true).order("sort_order");
    if (error) throw error;
    return (data ?? []).map(mapAlliance);
  } catch (error) {
    logFallback("alliances", error);
    return buildSeedContent().alliances;
  }
}

export async function getGiftCodes(): Promise<GiftCode[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.giftCodes);

  if (!isSupabaseConfigured()) return dropExpired(buildSeedContent().giftCodes);
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase
      .from("gift_codes")
      .select("*")
      .eq("active", true)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return dropExpired((data ?? []).map(mapGiftCode));
  } catch (error) {
    logFallback("gift codes", error);
    return dropExpired(buildSeedContent().giftCodes);
  }
}

// ---------------------------------------------------------------------------
// Heroes & KvK battle plan
// ---------------------------------------------------------------------------

export async function getHeroes(): Promise<Hero[]> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.heroes);

  if (!isSupabaseConfigured()) return buildSeedContent().heroes;
  try {
    const supabase = createPublicClient()!;
    const { data, error } = await supabase.from("heroes").select("*").eq("published", true).order("sort_order");
    if (error) throw error;
    if (!data || data.length === 0) return buildSeedContent().heroes;
    return data.map(mapHero);
  } catch (error) {
    logFallback("heroes", error);
    return buildSeedContent().heroes;
  }
}

/**
 * The active KvK battle plan, including its shared password.
 *
 * The `kvk_*` tables have no public read policy, so this goes through the
 * service-role client — server only. Callers must check the visitor's access
 * cookie before rendering anything from it, and must never pass the password
 * to a component. On any problem this returns `null` (the page shows "no plan")
 * rather than the seed plan, so a misconfigured deployment never unlocks
 * placeholder content with the default password. The seed plan is only used
 * when Supabase isn't configured at all (local design work).
 */
export async function getActiveKvkPlan(): Promise<KvkPlanWithSecret | null> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.kvk);

  if (!isSupabaseConfigured()) return buildSeedContent().kvkPlan;
  if (!isSupabaseAdminConfigured()) {
    log.error("The KvK battle plan needs SUPABASE_SECRET_KEY on the server (see SETUP.md)");
    return null;
  }
  try {
    const supabase = createAdminClient();
    const { data: plan, error } = await supabase
      .from("kvk_plans")
      .select("*")
      .eq("active", true)
      .eq("published", true)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!plan) return null;

    const [rules, coordinators, formations] = await Promise.all([
      supabase.from("kvk_rules").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
      supabase.from("kvk_coordinators").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
      supabase.from("kvk_formations").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
    ]);
    if (rules.error) throw rules.error;
    if (coordinators.error) throw coordinators.error;
    if (formations.error) throw formations.error;

    return mapKvkPlan(plan, rules.data ?? [], coordinators.data ?? [], formations.data ?? []);
  } catch (error) {
    log.error("Failed to load the KvK battle plan from Supabase", { error });
    return null;
  }
}
