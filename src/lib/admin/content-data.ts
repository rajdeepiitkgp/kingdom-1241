import { missingTable } from "@/lib/content/image-store";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/log";
import type { Localized } from "@/lib/i18n/localized";
import { announcementLive } from "./content-forms";
import { pendingColumns } from "./translation";

/**
 * The content editor's loaders (server only, uncached, service role): every
 * announcement, rule topic, rule, guide and alliance section, including the
 * drafts, hidden and expired ones the public loaders leave out. Callers check
 * the role first (`requireEditor`).
 */

const log = createLogger("admin");

export interface AdminAnnouncement {
  id: string;
  title: Localized;
  body: Localized;
  /** The Markdown per language; empty for rows written as HTML (the seed). */
  bodySource: Localized;
  pinned: boolean;
  published: boolean;
  publishedAt: string;
  expiresAt: string | null;
  updatedAt: string;
  /** Columns the pipeline still has to translate. */
  pending: string[];
  /** On Home now, a draft, or past its end. */
  state: "live" | "draft" | "expired";
}

type Row = Record<string, unknown>;

function mapAnnouncement(row: Row, now: number): AdminAnnouncement {
  const published = row.published !== false;
  const expiresAt = row.expires_at ? String(row.expires_at) : null;
  return {
    id: String(row.id),
    title: (row.title ?? {}) as Localized,
    body: (row.body ?? {}) as Localized,
    bodySource: (row.body_source ?? {}) as Localized,
    pinned: Boolean(row.pinned),
    published,
    publishedAt: String(row.published_at ?? ""),
    expiresAt,
    updatedAt: String(row.updated_at ?? ""),
    pending: pendingColumns("announcements", row),
    state: !published ? "draft" : announcementLive({ published, expiresAt }, now) ? "live" : "expired",
  };
}

/** Every announcement, pinned first, newest first; null when the database can't be read. */
export async function listAnnouncements(): Promise<AdminAnnouncement[] | null> {
  if (!isSupabaseAdminConfigured()) return null;
  // `*`: body_source arrives with migration 0020, and the list must work before it.
  const { data, error } = await createAdminClient()
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) {
    log.error("Reading announcements failed", { error: error.message, code: error.code });
    return null;
  }
  const now = Date.now();
  return (data ?? []).map((row) => mapAnnouncement(row, now));
}

export async function getAnnouncementForEditing(id: string): Promise<AdminAnnouncement | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("announcements").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Reading an announcement failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapAnnouncement(data, Date.now()) : null;
}

// ---------------------------------------------------------------------------
// Rules: topics with their rules, hidden ones included
// ---------------------------------------------------------------------------

export interface AdminRule {
  id: string;
  topicId: string;
  title: Localized;
  body: Localized;
  bodySource: Localized;
  published: boolean;
  pending: string[];
}

export interface AdminRuleTopic {
  id: string;
  slug: string;
  title: Localized;
  icon: string;
  published: boolean;
  pending: string[];
  rules: AdminRule[];
}

function mapRule(row: Row): AdminRule {
  return {
    id: String(row.id),
    topicId: String(row.topic_id),
    title: (row.title ?? {}) as Localized,
    body: (row.body ?? {}) as Localized,
    bodySource: (row.body_source ?? {}) as Localized,
    published: row.published !== false,
    pending: pendingColumns("rules", row),
  };
}

function mapTopic(row: Row, rules: AdminRule[]): AdminRuleTopic {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    title: (row.title ?? {}) as Localized,
    icon: String(row.icon ?? "📜"),
    published: row.published !== false,
    pending: pendingColumns("rule_topics", row),
    rules: rules.filter((rule) => rule.topicId === row.id),
  };
}

/** Every topic in page order with its rules in order; null when the database can't be read. */
export async function listRuleTopics(): Promise<AdminRuleTopic[] | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const admin = createAdminClient();
  const [topics, rules] = await Promise.all([
    admin.from("rule_topics").select("*").order("sort_order").order("created_at"),
    admin.from("rules").select("*").order("sort_order").order("created_at"),
  ]);
  const error = topics.error ?? rules.error;
  if (error) {
    log.error("Reading the rules failed", { error: error.message, code: error.code });
    return null;
  }
  const mapped = (rules.data ?? []).map(mapRule);
  return (topics.data ?? []).map((row) => mapTopic(row, mapped));
}

export async function getRuleTopicForEditing(id: string): Promise<AdminRuleTopic | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("rule_topics").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Reading a rule topic failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapTopic(data, []) : null;
}

export async function getRuleForEditing(id: string): Promise<AdminRule | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("rules").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Reading a rule failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapRule(data) : null;
}

// ---------------------------------------------------------------------------
// Guides and their alliance sections
// ---------------------------------------------------------------------------

export interface AdminGuideSection {
  id: string;
  guideId: string;
  allianceTag: string;
  body: Localized;
  bodySource: Localized;
  published: boolean;
  pending: string[];
}

export interface AdminGuide {
  id: string;
  slug: string;
  title: Localized;
  summary: Localized;
  body: Localized;
  bodySource: Localized;
  icon: string;
  published: boolean;
  updatedAt: string;
  pending: string[];
  /** The alliance sections; null while their table is missing (migration 0021 not applied yet). */
  sections: AdminGuideSection[] | null;
}

function mapSection(row: Row): AdminGuideSection {
  return {
    id: String(row.id),
    guideId: String(row.guide_id),
    allianceTag: String(row.alliance_tag ?? ""),
    body: (row.body ?? {}) as Localized,
    bodySource: (row.body_source ?? {}) as Localized,
    published: row.published !== false,
    pending: pendingColumns("guide_sections", row),
  };
}

function mapGuide(row: Row, sections: AdminGuideSection[] | null): AdminGuide {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    title: (row.title ?? {}) as Localized,
    summary: (row.summary ?? {}) as Localized,
    body: (row.body ?? {}) as Localized,
    bodySource: (row.body_source ?? {}) as Localized,
    icon: String(row.icon ?? "📖"),
    published: row.published !== false,
    updatedAt: String(row.updated_at ?? ""),
    pending: pendingColumns("guides", row),
    sections: sections && sections.filter((section) => section.guideId === row.id),
  };
}

/** The sections of one guide, or all; null while the table is missing, undefined when it can't be read. */
async function readSections(guideId?: string): Promise<AdminGuideSection[] | null | undefined> {
  let query = createAdminClient().from("guide_sections").select("*").order("created_at");
  if (guideId) query = query.eq("guide_id", guideId);
  const { data, error } = await query;
  if (missingTable(error)) return null;
  if (error) {
    log.error("Reading the guides' alliance sections failed", { error: error.message, code: error.code });
    return undefined;
  }
  return (data ?? []).map(mapSection);
}

/** Every guide in page order, hidden ones included; null when the database can't be read. */
export async function listGuides(): Promise<AdminGuide[] | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const [guides, sections] = await Promise.all([createAdminClient().from("guides").select("*").order("sort_order").order("created_at"), readSections()]);
  if (guides.error || sections === undefined) {
    if (guides.error) log.error("Reading the guides failed", { error: guides.error.message, code: guides.error.code });
    return null;
  }
  return (guides.data ?? []).map((row) => mapGuide(row, sections));
}

export async function getGuideForEditing(id: string): Promise<AdminGuide | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const [guide, sections] = await Promise.all([createAdminClient().from("guides").select("*").eq("id", id).maybeSingle(), readSections(id)]);
  if (guide.error) {
    log.error("Reading a guide failed", { error: guide.error.message, code: guide.error.code });
    return null;
  }
  return guide.data ? mapGuide(guide.data, sections ?? null) : null;
}

export async function getGuideSectionForEditing(guideId: string, id: string): Promise<AdminGuideSection | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("guide_sections").select("*").eq("id", id).eq("guide_id", guideId).maybeSingle();
  if (error) {
    if (!missingTable(error)) log.error("Reading an alliance section failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapSection(data) : null;
}
