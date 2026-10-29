import type { EventCategory } from "@/lib/data/types";

/**
 * Seed events. Times are placeholders in UTC — admins set the real schedule
 * for Kingdom 1241 later. `repeatEveryDays` makes an event recurring.
 */
export interface SeedEvent {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: EventCategory;
  icon: string;
  color: string;
  startsAt: string;
  durationMinutes: number;
  repeatEveryDays: number | null;
  /** A second day in each round, N days after the first. */
  alsoAfterDays?: number;
  /** Each alliance picks its own times: only the day is shown. */
  timing?: "alliance";
  guideSlug: string | null;
}

export const SEED_EVENTS: SeedEvent[] = [
  {
    id: "e1000000-0000-4000-8000-000000000001",
    slug: "bear-hunt",
    name: "Bear Hunt",
    summary: "Alliance rally event. Rally the bear for 30 minutes to earn Forgehammers and hero gear chests.",
    category: "alliance",
    icon: "🐻",
    color: "amber",
    startsAt: "2026-10-24T12:00:00.000Z",
    durationMinutes: 30,
    repeatEveryDays: 2,
    timing: "alliance",
    guideSlug: "bear-hunt",
  },
  {
    id: "e1000000-0000-4000-8000-000000000002",
    slug: "viking-vengeance",
    name: "Viking Vengeance",
    summary: "Defend your town and reinforce alliance members against 20 waves of Vikings.",
    category: "alliance",
    icon: "🪓",
    color: "red",
    // Every two weeks on a Tuesday and the Thursday after; the dates are placeholders.
    startsAt: "2026-11-03T00:00:00.000Z",
    durationMinutes: 60,
    repeatEveryDays: 14,
    alsoAfterDays: 2,
    timing: "alliance",
    guideSlug: "viking-vengeance",
  },
  {
    id: "e1000000-0000-4000-8000-000000000003",
    slug: "alliance-championship",
    name: "Alliance Championship",
    summary: "Weekly 3-lane alliance battles. Register one march, pick your lane, fight five automated rounds.",
    category: "alliance",
    icon: "🏆",
    color: "violet",
    startsAt: "2026-10-26T00:00:00.000Z",
    durationMinutes: 6 * 24 * 60,
    repeatEveryDays: 7,
    guideSlug: "alliance-championship",
  },
  {
    id: "e1000000-0000-4000-8000-000000000004",
    slug: "swordland-showdown",
    name: "Swordland Showdown",
    summary: "One-hour cross-kingdom alliance battle. Capture Sanctums and the Swordshrine for Relic Points.",
    category: "cross-kingdom",
    icon: "⚔️",
    color: "sky",
    startsAt: "2026-11-01T13:00:00.000Z",
    durationMinutes: 60,
    repeatEveryDays: 28,
    guideSlug: "swordland-showdown",
  },
  {
    id: "e1000000-0000-4000-8000-000000000005",
    slug: "kvk-castle-battle",
    name: "KvK — Castle Battle",
    summary: "Kingdom vs Kingdom battle day. Hold the castle for 2.5 hours to win the war for 1241.",
    category: "cross-kingdom",
    icon: "🏰",
    color: "gold",
    startsAt: "2026-11-14T12:00:00.000Z",
    durationMinutes: 300,
    repeatEveryDays: 28,
    guideSlug: "kvk",
  },
  {
    id: "e1000000-0000-4000-8000-000000000006",
    slug: "kvk-prep",
    name: "KvK — Preparation Phase",
    summary: "Five scoring days before the castle battle. Hit 200,000 points a day for chests and State Medals.",
    category: "kingdom",
    icon: "📜",
    color: "emerald",
    startsAt: "2026-11-09T00:00:00.000Z",
    durationMinutes: 5 * 24 * 60,
    repeatEveryDays: 28,
    guideSlug: "kvk",
  },
  {
    id: "e1000000-0000-4000-8000-000000000007",
    slug: "strongest-governor",
    name: "Strongest Governor",
    summary: "Seven-day solo scoring event: building, hero development, skills and troop training.",
    category: "solo",
    icon: "👑",
    color: "pink",
    startsAt: "2026-11-02T00:00:00.000Z",
    durationMinutes: 7 * 24 * 60,
    repeatEveryDays: 28,
    guideSlug: null,
  },
];
