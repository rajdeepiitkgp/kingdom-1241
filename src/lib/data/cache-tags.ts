/**
 * Cache tags of the content loaders (pure, so routes, actions and tests can
 * use them without pulling in the loaders themselves). Every loader in
 * index.ts tags its result with `all` plus its own tag; the translation
 * webhook and `/api/revalidate` expire by table through `cacheTagForTable`.
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
  retro: "content:kvk_retro",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** Map a table name (as used by Supabase webhooks) to its cache tag. */
export function cacheTagForTable(table: string): CacheTag | null {
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
    case "kvk_leader_briefs":
    case "kvk_leader_rules":
    case "kvk_rally_leaders":
      return CACHE_TAGS.kvk;
    case "kvk_retrospectives":
      return CACHE_TAGS.retro;
    default:
      return null;
  }
}
