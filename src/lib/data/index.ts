import { cacheLife, cacheTag } from "next/cache";
import { buildSeedContent, SEED_LANGUAGES, SEED_SETTINGS } from "@/content/seed";
import { getLanguageInfo, type SiteLanguage } from "@/lib/i18n/languages";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS } from "./cache-tags";
import {
  mapAlliance,
  mapAnnouncement,
  mapEvent,
  mapGiftCode,
  mapGuide,
  mapHero,
  mapKvkChecklistPlan,
  mapKvkLeaderPlan,
  mapKvkPlan,
  mapOpenRetrospective,
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
  KvkChecklistPlanWithSecret,
  KvkLeaderPlanWithSecret,
  KvkPlanWithSecret,
  OpenRetrospective,
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

export { CACHE_TAGS, cacheTagForTable } from "./cache-tags";

/** Drop rows whose `expiresAt` is in the past (evaluated when the cache entry is built). */
function dropExpired<T extends { expiresAt: string | null }>(rows: T[]): T[] {
  const now = Date.now();
  return rows.filter((row) => !row.expiresAt || Date.parse(row.expiresAt) > now);
}

const log = createLogger("data");

/** Degraded, not broken: the page still renders (from the seed), so this is a warning. */
function logFallback(what: string, error: unknown) {
  log.warn("Failed to load from Supabase, using seed content instead", { what, error });
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

/**
 * The rally-leader page of the active battle plan, including its own password.
 *
 * Same rules as `getActiveKvkPlan` (service role, server only, the caller
 * checks the leader cookie and strips the password; `null` on any problem,
 * never the seed outside local design work). `null` too when the active plan
 * has no published leader brief: the page then says "no leader plan yet".
 * The battle plan's own password is not read here.
 */
export async function getActiveLeaderPlan(): Promise<KvkLeaderPlanWithSecret | null> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.kvk);

  if (!isSupabaseConfigured()) return buildSeedContent().kvkLeaderPlan;
  if (!isSupabaseAdminConfigured()) return null;
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

    const [brief, rallies, rules] = await Promise.all([
      supabase.from("kvk_leader_briefs").select("*").eq("plan_id", plan.id).eq("published", true).maybeSingle(),
      supabase.from("kvk_rally_leaders").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
      supabase.from("kvk_leader_rules").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
    ]);
    const tableError = brief.error ?? rallies.error ?? rules.error;
    if (tableError?.code === "PGRST205" || tableError?.code === "42P01") {
      // Deployed before migration 0010 reached the database: "no leader plan yet" until it does.
      log.warn("Rally-leader tables are not in the database yet (migration 0010)");
      return null;
    }
    if (tableError) throw tableError;
    if (!brief.data) return null;

    return mapKvkLeaderPlan(plan, brief.data, rallies.data ?? [], rules.data ?? []);
  } catch (error) {
    log.error("Failed to load the rally-leader plan from Supabase", { error });
    return null;
  }
}

/**
 * The commander checklist of the active battle plan, including its own password.
 *
 * Same rules as `getActiveLeaderPlan` (service role, server only, the caller
 * checks the checklist cookie and strips the password; `null` on any problem
 * or without a published checklist brief). Neither the battle plan's nor the
 * leaders' password is read here.
 */
export async function getActiveChecklistPlan(): Promise<KvkChecklistPlanWithSecret | null> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.kvk);

  if (!isSupabaseConfigured()) return buildSeedContent().kvkChecklistPlan;
  if (!isSupabaseAdminConfigured()) return null;
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

    const [brief, items, rules] = await Promise.all([
      supabase.from("kvk_checklist_briefs").select("*").eq("plan_id", plan.id).eq("published", true).maybeSingle(),
      supabase.from("kvk_checklist_items").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
      supabase.from("kvk_checklist_rules").select("*").eq("plan_id", plan.id).eq("published", true).order("sort_order"),
    ]);
    const tableError = brief.error ?? items.error ?? rules.error;
    if (tableError?.code === "PGRST205" || tableError?.code === "42P01") {
      // Deployed before migration 0011 reached the database: "no checklist yet" until it does.
      log.warn("Checklist tables are not in the database yet (migration 0011)");
      return null;
    }
    if (tableError) throw tableError;
    if (!brief.data) return null;

    return mapKvkChecklistPlan(plan, brief.data, items.data ?? [], rules.data ?? []);
  } catch (error) {
    log.error("Failed to load the commander checklist from Supabase", { error });
    return null;
  }
}

/**
 * The feedback form that is accepting answers (at most one), with the plan it
 * belongs to. Like the plan it carries the plan password for the gate and must
 * never reach a component as is. The closing time is checked by the caller
 * (request time); `null` on any problem, so the page says "no form open".
 */
export async function getOpenRetrospective(): Promise<OpenRetrospective | null> {
  "use cache";
  cacheLife("content");
  cacheTag(CACHE_TAGS.all, CACHE_TAGS.kvk, CACHE_TAGS.retro);

  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return null;
  try {
    const supabase = createAdminClient();
    const { data: retro, error } = await supabase.from("kvk_retrospectives").select("*").eq("open", true).limit(1).maybeSingle();
    if (error) throw error;
    if (!retro) return null;
    const { data: plan, error: planError } = await supabase
      .from("kvk_plans")
      .select("id, slug, title, event_type, battle_at, password")
      .eq("id", retro.plan_id)
      .maybeSingle();
    if (planError) throw planError;
    if (!plan) return null;
    return mapOpenRetrospective(retro, plan);
  } catch (error) {
    log.error("Failed to load the open retrospective from Supabase", { error });
    return null;
  }
}
