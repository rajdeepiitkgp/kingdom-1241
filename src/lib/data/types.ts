import type { Localized } from "@/lib/i18n/localized";
import type { RetroAnalysis } from "@/lib/retro/analysis";
import type { RatingKey, RetroConfig, TextKey } from "@/lib/retro/questions";

/**
 * Content types shared by the database layer, the seed data and the pages.
 * Field names are camelCase here; the Supabase tables use snake_case and are
 * mapped in `src/lib/data/mappers.ts`.
 */

export interface Announcement {
  id: string;
  title: Localized;
  /** Sanitised HTML. */
  body: Localized;
  pinned: boolean;
  published: boolean;
  publishedAt: string; // ISO timestamp
  expiresAt: string | null;
}

export type EventCategory = "alliance" | "kingdom" | "cross-kingdom" | "solo";

export interface GameEvent {
  id: string;
  slug: string;
  name: Localized;
  /** Short plain-text description shown on cards. */
  summary: Localized;
  category: EventCategory;
  /** Emoji used as the event icon. */
  icon: string;
  /** Tailwind-friendly accent key, see `EVENT_COLORS` in the UI. */
  color: string;
  /** First (or only) occurrence, ISO timestamp in UTC. */
  startsAt: string;
  /** Duration of one occurrence in minutes. */
  durationMinutes: number;
  /** Repeat every N days (null = one-off). */
  repeatEveryDays: number | null;
  /** Optional link to a guide slug. */
  guideSlug: string | null;
  published: boolean;
}

export interface RuleTopic {
  id: string;
  slug: string;
  title: Localized;
  icon: string;
  sortOrder: number;
  published: boolean;
  rules: Rule[];
}

export interface Rule {
  id: string;
  topicId: string;
  title: Localized;
  /** Sanitised HTML. */
  body: Localized;
  sortOrder: number;
  published: boolean;
}

export interface Guide {
  id: string;
  slug: string;
  title: Localized;
  summary: Localized;
  /** Sanitised HTML. */
  body: Localized;
  icon: string;
  coverImageUrl: string | null;
  sortOrder: number;
  published: boolean;
  updatedAt: string;
}

export interface Alliance {
  id: string;
  tag: string;
  name: string;
  /** Hex colour used for the alliance badge. */
  color: string;
  leader: string | null;
  power: number | null;
  members: number | null;
  maxMembers: number;
  description: Localized;
  requirements: Localized;
  /** Main chat language(s) of the alliance, free text like "EN / DE". */
  languages: string | null;
  discordUrl: string | null;
  sortOrder: number;
  published: boolean;
}

export interface GiftCode {
  id: string;
  code: string;
  rewards: Localized;
  expiresAt: string | null;
  active: boolean;
  addedAt: string;
}

export interface SiteSettings {
  kingdomNumber: number;
  kingdomName: Localized;
  tagline: Localized;
  /** Hour (UTC) at which the in-game day resets. */
  dailyResetUtcHour: number;
  discordInviteUrl: string | null;
  /** Who to contact about transfers, shown while the transfer section is off. */
  transferContact: Localized;
  /** In-game name of the site's creator, shown in the footer ("Created by …"). */
  createdBy: string | null;
}

export interface UiString {
  key: string;
  text: Localized;
}

// ---------------------------------------------------------------------------
// Heroes & KvK battle plan
// ---------------------------------------------------------------------------

export type TroopType = "infantry" | "cavalry" | "archers";

export type HeroRarity = "legendary" | "epic" | "rare";

export interface Hero {
  id: string;
  slug: string;
  name: Localized;
  troopType: TroopType;
  rarity: HeroRarity;
  generation: number | null;
  /** Portrait URL (`/heroes/<slug>.png` for the bundled ones, or any https URL). */
  iconUrl: string | null;
  sortOrder: number;
  published: boolean;
}

/** Attack rallies on the castle, defence (garrison/reinforce), or either. */
export type FormationSide = "attack" | "defense" | "any";
/** Leading a rally, joining one, or either. */
export type FormationRole = "rally_lead" | "rally_join" | "any";

export interface KvkFormation {
  id: string;
  planId: string;
  /** The preset name players save in the game ("A", "B", …; the game offers 12 slots). */
  label: string;
  side: FormationSide;
  role: FormationRole;
  /** The three hero slots; `null` = any hero of the player's choice. */
  heroSlugs: [string | null, string | null, string | null];
  /** Troop ratio in percent; the three add up to 100. */
  infantry: number;
  cavalry: number;
  archers: number;
  note: Localized;
  sortOrder: number;
  published: boolean;
}

export type KvkRuleKind = "do" | "dont" | "info";

export interface KvkRule {
  id: string;
  planId: string;
  kind: KvkRuleKind;
  text: Localized;
  sortOrder: number;
  published: boolean;
}

/** The two battle alliances of the kingdom: [KvK] rallies the castle, [TMP] counter-rallies. */
export type CoordinatorTeam = "kvk" | "tmp";

/** Internal castle battle (practice inside 1241) or the cross-kingdom KvK; they alternate every two weeks. */
export type KvkEventType = "castle_battle" | "kvk";

export interface KvkCoordinator {
  id: string;
  planId: string;
  team: CoordinatorTeam;
  /** In-game name. */
  name: string;
  allianceTag: string | null;
  note: Localized;
  sortOrder: number;
  published: boolean;
}

export interface KvkPlan {
  id: string;
  slug: string;
  eventType: KvkEventType;
  title: Localized;
  opponent: string | null;
  /** Start of the castle battle, ISO timestamp (UTC), or null when not set yet. */
  battleAt: string | null;
  /** End of the battle (UTC), or null when not set: the page then keeps saying "Battle day!" after the start. */
  battleEndAt: string | null;
  /** Sanitised HTML. */
  intro: Localized;
  minHeroStars: number;
  /** Required level of the hero's top-right (expedition) skill. */
  minSkillLevel: number;
  active: boolean;
  published: boolean;
  updatedAt: string;
  rules: KvkRule[];
  coordinators: KvkCoordinator[];
  formations: KvkFormation[];
}

/** The plan plus its shared password — server only, never passed to components. */
export interface KvkPlanWithSecret extends KvkPlan {
  password: string;
}

/** Who a leader instruction is for: every leader, or only rally leads / garrison leads. */
export type LeaderAudience = "all" | "rally" | "garrison";

export interface KvkLeaderRule {
  id: string;
  planId: string;
  audience: LeaderAudience;
  kind: KvkRuleKind;
  text: Localized;
  sortOrder: number;
  published: boolean;
}

/** One rally on the rally-leader page: who leads it, where, when, with which of their own heroes and troop ratio. */
export interface KvkRallyLeader {
  id: string;
  planId: string;
  /** Which rally ("Castle — first wave"). */
  target: Localized;
  side: FormationSide;
  /** Battle alliance on the day ([KvK] rallies, [TMP] counter-rallies). */
  team: CoordinatorTeam;
  /** In-game name of the leader. */
  name: string;
  /** Home alliance (EOL, ULU, …). */
  allianceTag: string | null;
  /** Where to teleport / stand ("In front of the castle"). */
  position: Localized;
  /** When to start the rally (UTC ISO), or null. */
  startAt: string | null;
  /** When to activate pets, in minutes after the battle start (0 = at the start), or null for no pets. */
  petsOffsetMinutes: number | null;
  /** The leader's own three heroes; `null` = their choice. */
  heroSlugs: [string | null, string | null, string | null];
  infantry: number;
  cavalry: number;
  archers: number;
  note: Localized;
  sortOrder: number;
  published: boolean;
}

/**
 * The rally-leader page of the active battle plan: its own instructions and
 * roster behind its own password (kvk_leader_briefs + kvk_rally_leaders).
 */
export interface KvkLeaderPlan {
  /** The battle plan this page belongs to (the access cookie is bound to it). */
  planId: string;
  slug: string;
  eventType: KvkEventType;
  title: Localized;
  opponent: string | null;
  battleAt: string | null;
  battleEndAt: string | null;
  minSkillLevel: number;
  /** Sanitised HTML. */
  intro: Localized;
  updatedAt: string;
  rules: KvkLeaderRule[];
  rallies: KvkRallyLeader[];
}

/** The leader page plus its password — server only, never passed to components. */
export interface KvkLeaderPlanWithSecret extends KvkLeaderPlan {
  password: string;
}

// ---------------------------------------------------------------------------
// Battle retrospective (feedback form per battle plan)
// ---------------------------------------------------------------------------

export interface Retrospective {
  id: string;
  planId: string;
  /** Accepting answers (at most one retrospective is open at a time). */
  open: boolean;
  title: Localized;
  /** Sanitised HTML. */
  intro: Localized;
  /** Markdown source per language. */
  introSource: Localized;
  config: RetroConfig;
  /** Optional moment the form closes by itself (ISO, UTC). */
  closesAt: string | null;
  maxResponses: number;
  retentionDays: number;
  /** The stored AI summary, when one was run. */
  analysis: RetroAnalysis | null;
  analysisAt: string | null;
  /** How many responses the stored summary saw. */
  analysisCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** The plan a retrospective belongs to, as the public page needs it. The password stays on the server (see RetroGate). */
export interface RetroBattle {
  planId: string;
  slug: string;
  title: Localized;
  eventType: KvkEventType;
  battleAt: string | null;
}

export interface OpenRetrospective extends Retrospective {
  battle: RetroBattle & { password: string };
}

/** One player's answers. Identity fields are null unless the reader is the owner (see listResponses). */
export interface RetroResponse {
  id: string;
  retrospectiveId: string;
  governorId: string | null;
  gameName: string | null;
  allianceTag: string | null;
  /** Governor ID confirmed through MightPulse at submission. */
  verified: boolean;
  ratings: Partial<Record<RatingKey, number>>;
  texts: Record<TextKey, string>;
  /** The texts translated to English by the AI step (identical to the original when it was English); null until then. */
  textsEn: Partial<Record<TextKey, string>> | null;
  translatedAt: string | null;
  /** Page language the player wrote on (a hint about the text's language). */
  locale: string;
  createdAt: string;
}
