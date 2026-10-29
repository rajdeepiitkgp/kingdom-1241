import type { Localized } from "@/lib/i18n/localized";
import { EVENT_CATEGORIES } from "@/lib/events/options";
import { readStoredAnalysis } from "@/lib/retro/analysis";
import { isRatingKey, isTextKey, parseConfig, RATING_MAX, RATING_MIN, type RatingKey, TEXT_KEYS, type TextKey } from "@/lib/retro/questions";
import { hasTransferTerms, parseTransferTerms } from "@/lib/transfers/terms";
import type {
  Alliance,
  Announcement,
  ChecklistPhase,
  ChecklistSection,
  CoordinatorTeam,
  EventCategory,
  FormationRole,
  FormationSide,
  GameEvent,
  GiftCode,
  Guide,
  GuideSection,
  Hero,
  HeroRarity,
  KvkChecklistItem,
  KvkChecklistPlanWithSecret,
  KvkChecklistRule,
  KvkCoordinator,
  KvkEventType,
  KvkFormation,
  KvkLeaderPlanWithSecret,
  KvkLeaderRule,
  LeaderAudience,
  KvkPlanWithSecret,
  KvkRallyLeader,
  KvkRule,
  KvkRuleKind,
  OpenRetrospective,
  RetroBattle,
  RetroResponse,
  Retrospective,
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


export function mapEvent(row: Row): GameEvent {
  const category = EVENT_CATEGORIES.includes(row.category as EventCategory) ? (row.category as EventCategory) : "alliance";
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
    // Both arrive with migration 0022; until then every event is a one-day, same-for-everyone event.
    alsoAfterDays: numOrNull(row.also_after_days),
    timing: row.timing === "alliance" ? "alliance" : "fixed",
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

export function mapGuideSection(row: Row): GuideSection {
  return {
    id: str(row.id),
    guideId: str(row.guide_id),
    allianceTag: str(row.alliance_tag),
    body: loc(row.body),
    published: row.published !== false,
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
    source: row.source === "kingshot" ? "kingshot" : "manual",
    endedAt: row.ended_at ? iso(row.ended_at, "") || null : null,
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
    transfersOpen: typeof values.transfers_open === "boolean" ? values.transfers_open : defaults.transfersOpen,
    transferInfo: values.transfer_info ? loc(values.transfer_info) : defaults.transferInfo,
    transferTerms: "transfer_terms" in values ? parseTransferTerms(values.transfer_terms) : defaults.transferTerms,
    transferDiscordUrl: strOrNull(values.transfer_discord_url) ?? defaults.transferDiscordUrl,
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
    { key: "transfers_open", value: settings.transfersOpen },
    { key: "transfer_info", value: settings.transferInfo },
    { key: "transfer_terms", value: hasTransferTerms(settings.transferTerms) ? settings.transferTerms : null },
    { key: "transfer_discord_url", value: settings.transferDiscordUrl },
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
    battleEndAt: row.battle_end_at ? iso(row.battle_end_at, "") || null : null,
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

const AUDIENCES: readonly LeaderAudience[] = ["all", "rally", "garrison"];

export function mapKvkLeaderRule(row: Row): KvkLeaderRule {
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    audience: oneOf(row.audience, AUDIENCES, "all"),
    kind: oneOf(row.kind, RULE_KINDS, "info"),
    text: loc(row.text),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapKvkRallyLeader(row: Row): KvkRallyLeader {
  const slot = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    target: loc(row.target),
    side: oneOf(row.side, SIDES, "attack"),
    team: oneOf(row.team, TEAMS, "kvk"),
    name: str(row.name),
    allianceTag: strOrNull(row.alliance_tag),
    position: loc(row.position),
    startAt: row.start_at ? iso(row.start_at, "") || null : null,
    petsOffsetMinutes: petsOffset(row.pets_offset_minutes),
    heroSlugs: [slot(row.hero_1), slot(row.hero_2), slot(row.hero_3)],
    infantry: pct(row.infantry_pct),
    cavalry: pct(row.cavalry_pct),
    archers: pct(row.archers_pct),
    note: loc(row.note),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

function petsOffset(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 1440 ? n : null;
}

/**
 * The leader page of a plan: the plan row (title, time), its leader brief
 * (password, intro), its leader rules and rally rows (any plan's rows may be
 * passed; they are filtered by plan_id, unpublished ones dropped). "Updated"
 * is the latest change to the brief, a rule or a rally.
 */
export function mapKvkLeaderPlan(plan: Row, brief: Row, rallies: Row[], rules: Row[] = []): KvkLeaderPlanWithSecret {
  const planId = str(plan.id);
  const mine = rallies.filter((r) => str(r.plan_id) === planId);
  const myRules = rules.filter((r) => str(r.plan_id) === planId);
  const updatedAt = [brief, ...mine, ...myRules]
    .map((r) => iso(r.updated_at, ""))
    .filter(Boolean)
    .reduce((latest, value) => (value > latest ? value : latest), new Date(0).toISOString());
  return {
    planId,
    slug: str(plan.slug),
    eventType: oneOf(plan.event_type, EVENT_TYPES, "kvk"),
    title: loc(plan.title),
    opponent: strOrNull(plan.opponent),
    battleAt: plan.battle_at ? iso(plan.battle_at, "") || null : null,
    battleEndAt: plan.battle_end_at ? iso(plan.battle_end_at, "") || null : null,
    minSkillLevel: stars(plan.min_skill_level, 5),
    intro: loc(brief.intro),
    updatedAt,
    password: str(brief.password),
    rules: myRules
      .map(mapKvkLeaderRule)
      .filter((r) => r.published)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    rallies: mine
      .map(mapKvkRallyLeader)
      .filter((r) => r.published)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

const PHASES: readonly ChecklistPhase[] = ["before", "day", "during", "after"];
const SECTIONS: readonly ChecklistSection[] = ["commander", "general"];

export function mapKvkChecklistItem(row: Row): KvkChecklistItem {
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    phase: oneOf(row.phase, PHASES, "before"),
    text: loc(row.text),
    note: loc(row.note),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

export function mapKvkChecklistRule(row: Row): KvkChecklistRule {
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    section: oneOf(row.section, SECTIONS, "commander"),
    kind: oneOf(row.kind, RULE_KINDS, "info"),
    text: loc(row.text),
    sortOrder: num(row.sort_order, 0),
    published: row.published !== false,
  };
}

/**
 * The commander checklist of a plan: the plan row (title, time), its checklist
 * brief (password, intro), its items and its commander / guideline lines (any
 * plan's rows may be passed; they are filtered by plan_id, unpublished ones
 * dropped). "Updated" is the latest change to the brief, an item or a line.
 */
export function mapKvkChecklistPlan(plan: Row, brief: Row, items: Row[], rules: Row[] = []): KvkChecklistPlanWithSecret {
  const planId = str(plan.id);
  const myItems = items.filter((r) => str(r.plan_id) === planId);
  const myRules = rules.filter((r) => str(r.plan_id) === planId);
  const updatedAt = [brief, ...myItems, ...myRules]
    .map((r) => iso(r.updated_at, ""))
    .filter(Boolean)
    .reduce((latest, value) => (value > latest ? value : latest), new Date(0).toISOString());
  return {
    planId,
    slug: str(plan.slug),
    eventType: oneOf(plan.event_type, EVENT_TYPES, "kvk"),
    title: loc(plan.title),
    opponent: strOrNull(plan.opponent),
    battleAt: plan.battle_at ? iso(plan.battle_at, "") || null : null,
    battleEndAt: plan.battle_end_at ? iso(plan.battle_end_at, "") || null : null,
    intro: loc(brief.intro),
    updatedAt,
    password: str(brief.password),
    items: myItems
      .map(mapKvkChecklistItem)
      .filter((i) => i.published)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    rules: myRules
      .map(mapKvkChecklistRule)
      .filter((r) => r.published)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

// ---------------------------------------------------------------------------
// Battle retrospective
// ---------------------------------------------------------------------------

export function mapRetrospective(row: Row): Retrospective {
  return {
    id: str(row.id),
    planId: str(row.plan_id),
    open: Boolean(row.open),
    title: loc(row.title),
    intro: loc(row.intro),
    introSource: loc(row.intro_source),
    config: parseConfig(row.config),
    closesAt: row.closes_at ? iso(row.closes_at, "") || null : null,
    maxResponses: Math.max(1, Math.round(num(row.max_responses, 600))),
    retentionDays: Math.max(1, Math.round(num(row.retention_days, 30))),
    analysis: readStoredAnalysis(row.analysis),
    analysisAt: row.analysis_at ? iso(row.analysis_at, "") || null : null,
    analysisCount: numOrNull(row.analysis_count),
    createdAt: iso(row.created_at, new Date(0).toISOString()),
    updatedAt: iso(row.updated_at, new Date(0).toISOString()),
  };
}

/** The plan columns the feedback page shows (title, type, date) plus the password for the gate. */
export function mapRetroBattle(plan: Row): RetroBattle & { password: string } {
  return {
    planId: str(plan.id),
    slug: str(plan.slug),
    title: loc(plan.title),
    eventType: oneOf(plan.event_type, EVENT_TYPES, "kvk"),
    battleAt: plan.battle_at ? iso(plan.battle_at, "") || null : null,
    password: str(plan.password),
  };
}

export function mapOpenRetrospective(row: Row, plan: Row): OpenRetrospective {
  return { ...mapRetrospective(row), battle: mapRetroBattle(plan) };
}

function ratings(value: unknown): Partial<Record<RatingKey, number>> {
  const out: Partial<Record<RatingKey, number>> = {};
  if (!value || typeof value !== "object") return out;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isRatingKey(k) && typeof v === "number" && Number.isInteger(v) && v >= RATING_MIN && v <= RATING_MAX) out[k] = v;
  }
  return out;
}

function englishTexts(value: unknown): Partial<Record<TextKey, string>> | null {
  if (!value || typeof value !== "object") return null;
  const out: Partial<Record<TextKey, string>> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) if (isTextKey(k) && typeof v === "string") out[k] = v;
  return out;
}

/** `identity: false` leaves the Governor ID and name out (everyone but the owner). */
export function mapRetroResponse(row: Row, identity: boolean): RetroResponse {
  const texts = Object.fromEntries(TEXT_KEYS.map((key) => [key, str(row[key])])) as Record<TextKey, string>;
  return {
    id: str(row.id),
    retrospectiveId: str(row.retrospective_id),
    governorId: identity ? strOrNull(row.governor_id) : null,
    gameName: identity ? strOrNull(row.game_name) : null,
    allianceTag: strOrNull(row.alliance_tag),
    verified: Boolean(row.verified),
    ratings: ratings(row.ratings),
    texts,
    textsEn: englishTexts(row.texts_en),
    translatedAt: row.translated_at ? iso(row.translated_at, "") || null : null,
    locale: str(row.locale, "en"),
    createdAt: iso(row.created_at, new Date(0).toISOString()),
  };
}
