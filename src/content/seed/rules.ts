/**
 * Kingdom rules grouped by topic. Boilerplate — the real rules of 1241 are
 * entered by admins later. `bodyMarkdown` is converted to HTML when seeding.
 */
export interface SeedRule {
  id: string;
  title: string;
  bodyMarkdown: string;
}

export interface SeedRuleTopic {
  id: string;
  slug: string;
  title: string;
  icon: string;
  rules: SeedRule[];
}

export const SEED_RULE_TOPICS: SeedRuleTopic[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    slug: "general",
    title: "General conduct",
    icon: "🤝",
    rules: [
      {
        id: "d1100000-0000-4000-8000-000000000001",
        title: "Respect every governor",
        bodyMarkdown:
          "No insults, harassment, discrimination or spam in kingdom chat, alliance chat or on Discord. Disagreements are settled by alliance leaders (R4/R5), not in public chat.",
      },
      {
        id: "d1100000-0000-4000-8000-000000000002",
        title: "Kingdom chat is for everyone",
        bodyMarkdown:
          "Keep kingdom chat friendly and useful: event reminders, help requests, trading tiles. Recruitment messages are allowed once per hour per alliance.",
      },
      {
        id: "d1100000-0000-4000-8000-000000000003",
        title: "Decisions are made by the kingdom council",
        bodyMarkdown:
          "The leaders of all alliances form the kingdom council. Kingdom-wide decisions (KvK strategy, rule changes, transfers) are announced here and on Discord.",
      },
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000002",
    slug: "attacks",
    title: "Attacks & tiles",
    icon: "🛡️",
    rules: [
      {
        id: "d1200000-0000-4000-8000-000000000011",
        title: "No attacks inside the kingdom",
        bodyMarkdown:
          "Attacking towns of Kingdom 1241 governors is forbidden except during events that explicitly allow it, or in a duel agreed by both players. Report violations with a screenshot to an R4/R5.",
      },
      {
        id: "d1200000-0000-4000-8000-000000000012",
        title: "Resource tiles",
        bodyMarkdown:
          "Do not attack gatherers on resource tiles. Tiles inside another alliance's territory belong to that alliance — ask before gathering there. Higher-level tiles near the centre are shared on a first-come basis.",
      },
      {
        id: "d1200000-0000-4000-8000-000000000013",
        title: "Scouting",
        bodyMarkdown:
          "Scouting kingdom members is unnecessary and seen as a hostile act. Please don't.",
      },
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000003",
    slug: "events",
    title: "Events",
    icon: "📅",
    rules: [
      {
        id: "d1300000-0000-4000-8000-000000000021",
        title: "Bear Hunt",
        bodyMarkdown:
          "Each alliance schedules its own Bear Hunt. Join rallies with your best **archer-heavy** march and a strong first expedition hero. Don't open your own rally during the first five minutes unless your alliance asks you to.",
      },
      {
        id: "d1300000-0000-4000-8000-000000000022",
        title: "Viking Vengeance",
        bodyMarkdown:
          "Reinforce the alliance HQ and your buddy group before the first wave. Infantry first, cavalry second, archers stay home (unless the HQ asks for them for wave 20).",
      },
      {
        id: "d1300000-0000-4000-8000-000000000023",
        title: "Swordland Showdown & Alliance Championship",
        bodyMarkdown:
          "Only register if you can be online for the battle. Follow your R4's lane assignment in the Alliance Championship and the building assignments in Swordland.",
      },
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000004",
    slug: "kvk",
    title: "KvK",
    icon: "🏰",
    rules: [
      {
        id: "d1400000-0000-4000-8000-000000000031",
        title: "Preparation phase",
        bodyMarkdown:
          "Everyone contributes: aim for **200,000 points every day**. Save Mithril and high-value items for days 4 and 5 unless the council says otherwise. Don't spend your KvK items before prep starts.",
      },
      {
        id: "d1400000-0000-4000-8000-000000000032",
        title: "Battle day",
        bodyMarkdown:
          "Shield up before the battle starts unless you are assigned to attack or garrison. Follow the battle plan posted on this site and on Discord. Join rallies and garrisons — never solo attack the castle or turrets.",
      },
      {
        id: "d1400000-0000-4000-8000-000000000033",
        title: "Minister appointments",
        bodyMarkdown:
          "Ministers are appointed in the order of the booking list. Book your slot on this site (coming soon) and be online when it's your turn — if you miss it, the next person on the list is appointed.",
      },
    ],
  },
  {
    id: "d1000000-0000-4000-8000-000000000005",
    slug: "transfers",
    title: "Transfers & alliances",
    icon: "🚚",
    rules: [
      {
        id: "d1500000-0000-4000-8000-000000000041",
        title: "Switching alliances",
        bodyMarkdown:
          "You are free to move between alliances within the kingdom, but tell your R4 first and don't leave right before an event you registered for.",
      },
      {
        id: "d1500000-0000-4000-8000-000000000042",
        title: "Transfers in and out of 1241",
        bodyMarkdown:
          "Transfers are coordinated by the kingdom council. Check the home page for the current status and who to contact.",
      },
    ],
  },
];
