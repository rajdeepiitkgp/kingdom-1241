/**
 * Placeholder alliances. Replace tags, names, colours and leaders with the
 * real alliances of Kingdom 1241 (phase 4 syncs these from MightPulse).
 */
export interface SeedAlliance {
  id: string;
  tag: string;
  name: string;
  color: string;
  leader: string | null;
  power: number | null;
  members: number | null;
  maxMembers: number;
  description: string;
  requirements: string;
  languages: string | null;
  discordUrl: string | null;
  sortOrder: number;
}

export const SEED_ALLIANCES: SeedAlliance[] = [
  {
    id: "b1000000-0000-4000-8000-000000000001",
    tag: "AAA",
    name: "Alpha Alliance",
    color: "#3b82f6",
    leader: "Leader name",
    power: 1_250_000_000,
    members: 98,
    maxMembers: 100,
    description: "Placeholder: the kingdom's main fighting alliance. Replace with your real alliance.",
    requirements: "Town Center 25+, active daily, Discord required.",
    languages: "EN / DE",
    discordUrl: null,
    sortOrder: 0,
  },
  {
    id: "b1000000-0000-4000-8000-000000000002",
    tag: "BBB",
    name: "Bravo Brigade",
    color: "#f59e0b",
    leader: "Leader name",
    power: 980_000_000,
    members: 92,
    maxMembers: 100,
    description: "Placeholder: a strong second alliance focused on events and growth.",
    requirements: "Town Center 22+, join Bear Hunt and KvK.",
    languages: "EN / PL",
    discordUrl: null,
    sortOrder: 1,
  },
  {
    id: "b1000000-0000-4000-8000-000000000003",
    tag: "CCC",
    name: "Charlie Company",
    color: "#10b981",
    leader: "Leader name",
    power: 640_000_000,
    members: 85,
    maxMembers: 100,
    description: "Placeholder: a friendly home for newer and casual governors.",
    requirements: "Everyone welcome — just be active and friendly.",
    languages: "EN / KO / AR",
    discordUrl: null,
    sortOrder: 2,
  },
];
