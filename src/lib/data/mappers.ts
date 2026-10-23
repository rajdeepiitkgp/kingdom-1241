import type { Localized } from "@/lib/i18n/localized";
import type {
  Alliance,
  Announcement,
  EventCategory,
  GameEvent,
  GiftCode,
  Guide,
  Rule,
  RuleTopic,
  SiteSettings,
  UiString,
} from "./types";

/**
 * Supabase rows (snake_case) → application types (camelCase).
 * Kept deliberately defensive: a half-filled row from the admin panel must
 * never crash a page.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function loc(value: unknown): Localized {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Localized = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  }
  if (typeof value === "string") return { en: value };
  return {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function numOrNull(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function iso(value: unknown, fallback: string): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return fallback;
}

export function mapAnnouncement(row: Row): Announcement {
  return {
    id: str(row.id),
    title: loc(row.title),
    body: loc(row.body),
    pinned: Boolean(row.pinned),
    published: row.published !== false,
    publishedAt: iso(row.published_at, new Date(0).toISOString()),
    expiresAt: row.expires_at ? iso(row.expires_at, "") || null : null,
  };
}

const CATEGORIES: EventCategory[] = ["alliance", "kingdom", "cross-kingdom", "solo"];

export function mapEvent(row: Row): GameEvent {
  const category = CATEGORIES.includes(row.category) ? (row.category as EventCategory) : "alliance";
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: loc(row.name),
    summary: loc(row.summary),
    category,
    icon: str(row.icon, "📅"),
    color: str(row.color, "sky"),
    startsAt: iso(row.starts_at, new Date(0).toISOString()),
    durationMinutes: Math.max(1, num(row.duration_minutes, 60)),
    repeatEveryDays: numOrNull(row.repeat_every_days),
    guideSlug: strOrNull(row.guide_slug),
    published: row.published !== false,
  };
}

export function mapRule(row: Row): Rule {
  return {
    id: str(row.id),
    topicId: str(row.topic_id),
    title: loc(row.title),
    body: loc(row.body),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapRuleTopic(row: Row, rules: Rule[]): RuleTopic {
  return {
    id: str(row.id),
    slug: str(row.slug),
    title: loc(row.title),
    icon: str(row.icon, "📜"),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
    rules: rules.filter((r) => r.topicId === row.id).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export function mapGuide(row: Row): Guide {
  return {
    id: str(row.id),
    slug: str(row.slug),
    title: loc(row.title),
    summary: loc(row.summary),
    body: loc(row.body),
    icon: str(row.icon, "📖"),
    coverImageUrl: strOrNull(row.cover_image_url),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
    updatedAt: iso(row.updated_at, new Date(0).toISOString()),
  };
}

export function mapAlliance(row: Row): Alliance {
  return {
    id: str(row.id),
    tag: str(row.tag),
    name: str(row.name),
    color: str(row.color, "#3b82f6"),
    leader: strOrNull(row.leader),
    power: numOrNull(row.power),
    members: numOrNull(row.members),
    maxMembers: num(row.max_members, 100),
    description: loc(row.description),
    requirements: loc(row.requirements),
    languages: strOrNull(row.languages),
    discordUrl: strOrNull(row.discord_url),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapGiftCode(row: Row): GiftCode {
  return {
    id: str(row.id),
    code: str(row.code),
    rewards: loc(row.rewards),
    expiresAt: row.expires_at ? iso(row.expires_at, "") || null : null,
    active: row.active !== false,
    addedAt: iso(row.added_at, new Date(0).toISOString()),
  };
}

export function mapUiString(row: Row): UiString {
  return { key: str(row.key), text: loc(row.text) };
}

/** `site_settings` is key/value; merge rows over the defaults. */
export function mapSettings(rows: Row[], defaults: SiteSettings): SiteSettings {
  const values: Record<string, unknown> = {};
  for (const row of rows) values[str(row.key)] = row.value;
  return {
    kingdomNumber: num(values.kingdom_number, defaults.kingdomNumber),
    kingdomName: values.kingdom_name ? loc(values.kingdom_name) : defaults.kingdomName,
    tagline: values.tagline ? loc(values.tagline) : defaults.tagline,
    dailyResetUtcHour: num(values.daily_reset_utc_hour, defaults.dailyResetUtcHour),
    discordInviteUrl: strOrNull(values.discord_invite_url) ?? defaults.discordInviteUrl,
    transferContact: values.transfer_contact ? loc(values.transfer_contact) : defaults.transferContact,
  };
}

/** Application settings → `site_settings` rows (used by the seed script). */
export function settingsToRows(settings: SiteSettings): Array<{ key: string; value: unknown }> {
  return [
    { key: "kingdom_number", value: settings.kingdomNumber },
    { key: "kingdom_name", value: settings.kingdomName },
    { key: "tagline", value: settings.tagline },
    { key: "daily_reset_utc_hour", value: settings.dailyResetUtcHour },
    { key: "discord_invite_url", value: settings.discordInviteUrl },
    { key: "transfer_contact", value: settings.transferContact },
  ];
}
