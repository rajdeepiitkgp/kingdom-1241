import type { Localized } from "@/lib/i18n/localized";

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
}

export interface UiString {
  key: string;
  text: Localized;
}
