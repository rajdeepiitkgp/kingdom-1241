import type {
  Alliance,
  Announcement,
  GameEvent,
  GiftCode,
  Guide,
  RuleTopic,
  SiteSettings,
  UiString,
} from "@/lib/data/types";
import { markdownToHtml } from "@/lib/html";
import { en } from "@/lib/i18n/localized";
import { SEED_ALLIANCES } from "./alliances";
import { SEED_ANNOUNCEMENTS } from "./announcements";
import { SEED_EVENTS } from "./events";
import { SEED_GIFT_CODES } from "./gift-codes";
import { SEED_GUIDES } from "./guides";
import { SEED_LANGUAGES } from "./languages";
import { SEED_RULE_TOPICS } from "./rules";
import { SEED_SETTINGS } from "./settings";
import { UI_STRINGS } from "./ui-strings";

export { SEED_LANGUAGES, SEED_SETTINGS, UI_STRINGS };

/**
 * The seed content in the same shape the pages consume. Used by
 * `scripts/seed.ts` to fill Supabase, and by the data layer as a fallback when
 * Supabase isn't configured (e.g. the very first local run).
 */
export interface SeedContent {
  settings: SiteSettings;
  uiStrings: UiString[];
  announcements: Announcement[];
  events: GameEvent[];
  ruleTopics: RuleTopic[];
  guides: Guide[];
  alliances: Alliance[];
  giftCodes: GiftCode[];
}

export function buildSeedContent(): SeedContent {
  const now = "2026-10-23T10:00:00.000Z";

  return {
    settings: SEED_SETTINGS,
    uiStrings: Object.entries(UI_STRINGS).map(([key, text]) => ({ key, text })),
    announcements: SEED_ANNOUNCEMENTS.map((a) => ({
      id: a.id,
      title: en(a.title),
      body: en(markdownToHtml(a.bodyMarkdown)),
      pinned: a.pinned,
      published: true,
      publishedAt: a.publishedAt,
      expiresAt: a.expiresAt,
    })),
    events: SEED_EVENTS.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: en(e.name),
      summary: en(e.summary),
      category: e.category,
      icon: e.icon,
      color: e.color,
      startsAt: e.startsAt,
      durationMinutes: e.durationMinutes,
      repeatEveryDays: e.repeatEveryDays,
      guideSlug: e.guideSlug,
      published: true,
    })),
    ruleTopics: SEED_RULE_TOPICS.map((topic, topicIndex) => ({
      id: topic.id,
      slug: topic.slug,
      title: en(topic.title),
      icon: topic.icon,
      sortOrder: topicIndex,
      published: true,
      rules: topic.rules.map((rule, ruleIndex) => ({
        id: rule.id,
        topicId: topic.id,
        title: en(rule.title),
        body: en(markdownToHtml(rule.bodyMarkdown)),
        sortOrder: ruleIndex,
        published: true,
      })),
    })),
    guides: SEED_GUIDES.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: en(g.title),
      summary: en(g.summary),
      body: en(markdownToHtml(g.bodyMarkdown)),
      icon: g.icon,
      coverImageUrl: null,
      sortOrder: g.sortOrder,
      published: true,
      updatedAt: now,
    })),
    alliances: SEED_ALLIANCES.map((a) => ({
      id: a.id,
      tag: a.tag,
      name: a.name,
      color: a.color,
      leader: a.leader,
      power: a.power,
      members: a.members,
      maxMembers: a.maxMembers,
      description: en(a.description),
      requirements: en(a.requirements),
      languages: a.languages,
      discordUrl: a.discordUrl,
      sortOrder: a.sortOrder,
      published: true,
    })),
    giftCodes: SEED_GIFT_CODES.map((c) => ({
      id: c.id,
      code: c.code,
      rewards: en(c.rewards),
      expiresAt: c.expiresAt,
      active: true,
      addedAt: c.addedAt,
    })),
  };
}
