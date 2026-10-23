/**
 * Alliances of Kingdom 1241, taken from the in-game "Alliance Power" ranking
 * on 23 Oct 2026. Tags, names and power are real; the colours follow the
 * in-game banners. Leader, member count, description and requirements are
 * left empty for each R5 to fill in — edit the `alliances` table (admin panel
 * in phase 2, MightPulse sync in phase 4). The home page reads the table, not
 * this file, once Supabase is configured.
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
    id: "b2000000-0000-4000-8000-000000000001",
    tag: "NAM",
    name: "NewAgeMonarchs",
    color: "#e2559b",
    leader: null,
    power: 25_577_424_312,
    members: null,
    maxMembers: 100,
    description: "",
    requirements: "",
    languages: null,
    discordUrl: null,
    sortOrder: 0,
  },
  {
    id: "b2000000-0000-4000-8000-000000000002",
    tag: "ULU",
    name: "TURAN",
    color: "#3b7fe4",
    leader: null,
    power: 23_953_880_847,
    members: null,
    maxMembers: 100,
    description: "",
    requirements: "",
    languages: null,
    discordUrl: null,
    sortOrder: 1,
  },
  {
    id: "b2000000-0000-4000-8000-000000000003",
    tag: "EOL",
    name: "EliteOutlaws",
    color: "#7b5df2",
    leader: null,
    power: 16_409_674_875,
    members: null,
    maxMembers: 100,
    description: "",
    requirements: "",
    languages: null,
    discordUrl: null,
    sortOrder: 2,
  },
  {
    id: "b2000000-0000-4000-8000-000000000004",
    tag: "OLD",
    name: "OldCamp",
    color: "#3fae6a",
    leader: null,
    power: 8_752_236_959,
    members: null,
    maxMembers: 100,
    description: "",
    requirements: "",
    languages: null,
    discordUrl: null,
    sortOrder: 3,
  },
  {
    id: "b2000000-0000-4000-8000-000000000005",
    tag: "PHX",
    name: "PhoenixMoonBlade",
    color: "#38a3e0",
    leader: null,
    power: 4_453_991_918,
    members: null,
    maxMembers: 100,
    description: "",
    requirements: "",
    languages: null,
    discordUrl: null,
    sortOrder: 4,
  },
];
