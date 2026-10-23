import type { Localized } from "@/lib/i18n/localized";
import type {
  Alliance,
  Announcement,
  CoordinatorTeam,
  EventCategory,
  FormationRole,
  FormationSide,
  GameEvent,
  GiftCode,
  Guide,
  Hero,
  HeroRarity,
  KvkCoordinator,
  KvkEventType,
  KvkFormation,
  KvkPlanWithSecret,
  KvkRule,
  KvkRuleKind,
  Rule,
  RuleTopic,
  SiteSettings,
  TroopType,
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
    createdBy: strOrNull(values.created_by) ?? defaults.createdBy,
  };
}

/**
 * Application settings → `site_settings` rows (used by the seed script).
 * `value` is `jsonb not null`, so settings that are null (e.g. no Discord
 * invite yet) are left out; `mapSettings` falls back to the defaults for
 * missing keys.
 */
export function settingsToRows(settings: SiteSettings): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = [
    { key: "kingdom_number", value: settings.kingdomNumber },
    { key: "kingdom_name", value: settings.kingdomName },
    { key: "tagline", value: settings.tagline },
    { key: "daily_reset_utc_hour", value: settings.dailyResetUtcHour },
    { key: "discord_invite_url", value: settings.discordInviteUrl },
    { key: "transfer_contact", value: settings.transferContact },
    { key: "created_by", value: settings.createdBy },
  ];
  return rows.filter((row) => row.value !== null && row.value !== undefined);
}

// ---------------------------------------------------------------------------
// Heroes & KvK battle plan
// ---------------------------------------------------------------------------

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

const TROOP_TYPES: readonly TroopType[] = ["infantry", "cavalry", "archers"];
const RARITIES: readonly HeroRarity[] = ["legendary", "epic", "rare"];
const SIDES: readonly FormationSide[] = ["attack", "defense", "any"];
const ROLES: readonly FormationRole[] = ["rally_lead", "rally_join", "any"];
const RULE_KINDS: readonly KvkRuleKind[] = ["do", "dont", "info"];
const TEAMS: readonly CoordinatorTeam[] = ["kvk", "tmp"];
const EVENT_TYPES: readonly KvkEventType[] = ["castle_battle", "kvk"];

/** Whole percentage between 0 and 100. */
function pct(value: unknown): number {
  return Math.min(100, Math.max(0, Math.round(num(value, 0))));
}

/** 0–5 (hero stars / skill level). */
function stars(value: unknown, fallback: number): number {
  return Math.min(5, Math.max(0, Math.round(num(value, fallback))));
}

export function mapHero(row: Row): Hero {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: loc(row.name),
    troopType: oneOf(row.troop_type, TROOP_TYPES, "infantry"),
    rarity: oneOf(row.rarity, RARITIES, "legendary"),
    generation: numOrNull(row.generation),
    iconUrl: strOrNull(row.icon_url),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapKvkRule(row: Row): KvkRule {
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    kind: oneOf(row.kind, RULE_KINDS, "info"),
    text: loc(row.text),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapKvkCoordinator(row: Row): KvkCoordinator {
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    team: oneOf(row.team, TEAMS, "kvk"),
    name: str(row.name),
    allianceTag: strOrNull(row.alliance_tag),
    note: loc(row.note),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapKvkFormation(row: Row): KvkFormation {
  const slot = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    label: str(row.label, "?"),
    side: oneOf(row.side, SIDES, "any"),
    role: oneOf(row.role, ROLES, "any"),
    heroSlugs: [slot(row.hero_1), slot(row.hero_2), slot(row.hero_3)],
    infantry: pct(row.infantry_pct),
    cavalry: pct(row.cavalry_pct),
    archers: pct(row.archers_pct),
    note: loc(row.note),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

/** A plan row with its child rows (any plan's rows may be passed; they are filtered by plan_id). */
export function mapKvkPlan(row: Row, rules: Row[], coordinators: Row[], formations: Row[]): KvkPlanWithSecret {
  const id = str(row.id);
  const ofPlan = (r: Row) => str(r.plan_id) === id;
  const byOrder = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;
  return {
    id,
    slug: str(row.slug),
    eventType: oneOf(row.event_type, EVENT_TYPES, "kvk"),
    title: loc(row.title),
    opponent: strOrNull(row.opponent),
    battleAt: row.battle_at ? iso(row.battle_at, "") || null : null,
    intro: loc(row.intro),
    minHeroStars: stars(row.min_hero_stars, 4),
    minSkillLevel: stars(row.min_skill_level, 5),
    active: Boolean(row.active),
    published: row.published !== false,
    updatedAt: iso(row.updated_at, new Date(0).toISOString()),
    password: str(row.password),
    rules: rules.filter(ofPlan).map(mapKvkRule).filter((r) => r.published).sort(byOrder),
    coordinators: coordinators.filter(ofPlan).map(mapKvkCoordinator).filter((c) => c.published).sort(byOrder),
    formations: formations.filter(ofPlan).map(mapKvkFormation).filter((f) => f.published).sort(byOrder),
  };
}
