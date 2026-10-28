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
import { bundledHeroIcon, SEED_HEROES } from "./heroes";
import {
  kvkChecklistItemId,
  kvkChecklistRuleId,
  kvkCoordinatorId,
  kvkFormationId,
  kvkLeaderRuleId,
  kvkRallyLeaderId,
  kvkRuleId,
  SEED_CHECKLIST,
  SEED_KVK_PLAN,
  SEED_LEADER_BRIEF,
  seedChecklistPassword,
  seedKvkPassword,
  seedLeaderPassword,
} from "./kvk";
import { SEED_LANGUAGES } from "./languages";
import { SEED_RULE_TOPICS } from "./rules";
import { SEED_SETTINGS } from "./settings";
import { withReviewed } from "./ui-reviewed";
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
  heroes: Hero[];
  /** Placeholder battle plan, with the seed password — server only. */
  kvkPlan: KvkPlanWithSecret;
  kvkLeaderPlan: KvkLeaderPlanWithSecret;
  kvkChecklistPlan: KvkChecklistPlanWithSecret;
}

export function buildSeedContent(): SeedContent {
  const now = "2026-10-23T10:00:00.000Z";

  return {
    settings: SEED_SETTINGS,
    uiStrings: Object.entries(UI_STRINGS).map(([key, text]) => ({ key, text: withReviewed(key, text) })),
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
      source: "manual" as const,
      endedAt: null,
    })),
    heroes: SEED_HEROES.map((h, index) => ({
      id: h.id,
      slug: h.slug,
      name: en(h.name),
      troopType: h.troopType,
      rarity: h.rarity,
      generation: h.generation,
      iconUrl: bundledHeroIcon(h.slug),
      sortOrder: index,
      published: true,
    })),
    kvkPlan: buildSeedKvkPlan(now),
    kvkLeaderPlan: buildSeedLeaderPlan(now),
    kvkChecklistPlan: buildSeedChecklistPlan(now),
  };
}

function buildSeedKvkPlan(now: string): KvkPlanWithSecret {
  const plan = SEED_KVK_PLAN;
  return {
    id: plan.id,
    slug: plan.slug,
    eventType: plan.eventType,
    title: en(plan.title),
    opponent: plan.opponent,
    battleAt: plan.battleAt,
    battleEndAt: null,
    intro: en(markdownToHtml(plan.introMarkdown)),
    minHeroStars: plan.minHeroStars,
    minSkillLevel: plan.minSkillLevel,
    active: true,
    published: true,
    updatedAt: now,
    password: seedKvkPassword(),
    rules: plan.rules.map((rule, index) => ({
      id: kvkRuleId(index),
      planId: plan.id,
      kind: rule.kind,
      text: en(rule.text),
      sortOrder: index,
      published: true,
    })),
    coordinators: plan.coordinators.map((c, index) => ({
      id: kvkCoordinatorId(index),
      planId: plan.id,
      team: c.team,
      name: c.name,
      allianceTag: c.allianceTag,
      note: en(c.note),
      sortOrder: index,
      published: true,
    })),
    formations: plan.formations.map((f, index) => ({
      id: kvkFormationId(index),
      planId: plan.id,
      label: f.label,
      side: f.side,
      role: f.role,
      heroSlugs: f.heroes,
      infantry: f.infantry,
      cavalry: f.cavalry,
      archers: f.archers,
      note: en(f.note),
      sortOrder: index,
      published: true,
    })),
  };
}

function buildSeedLeaderPlan(now: string): KvkLeaderPlanWithSecret {
  const plan = SEED_KVK_PLAN;
  return {
    planId: plan.id,
    slug: plan.slug,
    eventType: plan.eventType,
    title: en(plan.title),
    opponent: plan.opponent,
    battleAt: plan.battleAt,
    battleEndAt: null,
    minSkillLevel: plan.minSkillLevel,
    intro: en(markdownToHtml(SEED_LEADER_BRIEF.introMarkdown)),
    updatedAt: now,
    password: seedLeaderPassword(),
    rules: SEED_LEADER_BRIEF.rules.map((rule, index) => ({
      id: kvkLeaderRuleId(index),
      planId: plan.id,
      audience: rule.audience,
      kind: rule.kind,
      text: en(rule.text),
      sortOrder: index,
      published: true,
    })),
    rallies: SEED_LEADER_BRIEF.rallies.map((r, index) => ({
      id: kvkRallyLeaderId(index),
      planId: plan.id,
      target: en(r.target),
      side: r.side,
      team: r.team,
      name: r.name,
      allianceTag: r.allianceTag,
      position: en(r.position),
      startAt: null,
      petsOffsetMinutes: r.petsOffsetMinutes,
      heroSlugs: r.heroes,
      infantry: r.infantry,
      cavalry: r.cavalry,
      archers: r.archers,
      note: en(r.note),
      sortOrder: index,
      published: true,
    })),
  };
}

function buildSeedChecklistPlan(now: string): KvkChecklistPlanWithSecret {
  const plan = SEED_KVK_PLAN;
  return {
    planId: plan.id,
    slug: plan.slug,
    eventType: plan.eventType,
    title: en(plan.title),
    opponent: plan.opponent,
    battleAt: plan.battleAt,
    battleEndAt: null,
    intro: en(markdownToHtml(SEED_CHECKLIST.introMarkdown)),
    updatedAt: now,
    password: seedChecklistPassword(),
    items: SEED_CHECKLIST.items.map((item, index) => ({
      id: kvkChecklistItemId(index),
      planId: plan.id,
      phase: item.phase,
      text: en(item.text),
      note: en(item.note),
      sortOrder: index,
      published: true,
    })),
    rules: SEED_CHECKLIST.rules.map((rule, index) => ({
      id: kvkChecklistRuleId(index),
      planId: plan.id,
      section: rule.section,
      kind: rule.kind,
      text: en(rule.text),
      sortOrder: index,
      published: true,
    })),
  };
}
