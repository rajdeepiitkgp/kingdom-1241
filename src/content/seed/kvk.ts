import type { CoordinatorTeam, FormationRole, FormationSide, KvkEventType, KvkRuleKind } from "@/lib/data/types";

/**
 * Seed battle plan for the password-locked KvK page.
 *
 * Kingdom 1241 alternates two events every two weeks: the internal castle
 * battle (practice inside the kingdom) and KvK (against another kingdom). The
 * same page serves both; `eventType` says which one a plan is for. [KvK] and
 * [TMP] are the kingdom's two battle alliances ([KvK] rallies the castle,
 * [TMP] counter-rallies).
 *
 * The wording follows the coordinators' briefing for the internal castle
 * battle; the names, date and formation assignments are PLACEHOLDERS for the
 * council to edit in the `kvk_*` tables. The password is set by the seed script
 * (KVK_SEED_PASSWORD, default "1241") and should be changed right away.
 */
export interface SeedKvkFormation {
  label: string;
  side: FormationSide;
  role: FormationRole;
  /** Three hero slots; `null` means "any hero of your choice". */
  heroes: [string | null, string | null, string | null];
  infantry: number;
  cavalry: number;
  archers: number;
  note: string;
}

export interface SeedKvkPlan {
  id: string;
  slug: string;
  eventType: KvkEventType;
  title: string;
  opponent: string | null;
  battleAt: string | null;
  introMarkdown: string;
  minHeroStars: number;
  minSkillLevel: number;
  rules: Array<{ kind: KvkRuleKind; text: string }>;
  coordinators: Array<{ team: CoordinatorTeam; name: string; allianceTag: string | null; note: string }>;
  formations: SeedKvkFormation[];
}

const PLAN_ID = "d1000000-0000-4000-8000-000000000001";

export const SEED_KVK_PLAN: SeedKvkPlan = {
  id: PLAN_ID,
  slug: "castle-battle-placeholder",
  eventType: "castle_battle",
  title: "Internal castle battle — placeholder plan",
  opponent: null,
  battleAt: null,
  introMarkdown: `Hello everyone! 👋

The **internal castle battle** is tomorrow — please read the instructions below.

We use the internal battle to try different strategies and different heroes ahead of the real KvK in two weeks, so the troop formations will change. Always follow the coordinators' instructions to know which formation to use.

Set up your rallies today, and if you need help, we are all here. 💪

> Kingdom council: this is placeholder text. Edit the plan in the \`kvk_plans\` table (title, date, this introduction) and the formations in \`kvk_formations\`.`,
  minHeroStars: 4,
  minSkillLevel: 5,
  rules: [
    {
      kind: "dont",
      text: "No buffs except pet buffs and the Deployment Capacity buff — this saves gems for the whole kingdom.",
    },
    { kind: "do", text: "Everyone starts in the [KvK] alliance. The coordinators move players to [TMP] as needed." },
    {
      kind: "do",
      text: "Follow the coordinators' instructions — it is what keeps the battle organised and running smoothly.",
    },
    {
      kind: "info",
      text: "Prepare the formations below, but only with heroes whose top-right skill is at level 5. Save each one in the game's Troop Ratio presets.",
    },
  ],
  coordinators: [
    { team: "kvk", name: "Coordinator name (placeholder)", allianceTag: "NAM", note: "English / Arabic" },
    { team: "kvk", name: "Coordinator name (placeholder)", allianceTag: "ULU", note: "" },
    { team: "tmp", name: "Coordinator name (placeholder)", allianceTag: "EOL", note: "" },
  ],
  formations: [
    { label: "A", side: "any", role: "any", heroes: ["amane", null, null], infantry: 50, cavalry: 15, archers: 35, note: "" },
    { label: "B", side: "any", role: "any", heroes: ["chenko", null, null], infantry: 50, cavalry: 15, archers: 35, note: "" },
    { label: "C", side: "any", role: "any", heroes: ["amane", null, null], infantry: 50, cavalry: 0, archers: 50, note: "" },
    { label: "D", side: "any", role: "any", heroes: ["chenko", null, null], infantry: 50, cavalry: 0, archers: 50, note: "" },
    { label: "E", side: "any", role: "any", heroes: ["hilde", null, null], infantry: 60, cavalry: 40, archers: 0, note: "" },
    { label: "F", side: "any", role: "any", heroes: ["hilde", null, null], infantry: 60, cavalry: 0, archers: 40, note: "" },
    { label: "G", side: "any", role: "any", heroes: ["eric", null, null], infantry: 60, cavalry: 40, archers: 0, note: "" },
    { label: "H", side: "any", role: "any", heroes: ["eric", null, null], infantry: 60, cavalry: 0, archers: 40, note: "" },
    { label: "I", side: "any", role: "any", heroes: ["saul", null, null], infantry: 60, cavalry: 40, archers: 0, note: "" },
  ],
};

/** Stable ids for the child rows, so re-seeding never duplicates them. */
export const kvkRuleId = (index: number) => `d2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
export const kvkCoordinatorId = (index: number) => `d3000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
export const kvkFormationId = (index: number) => `d4000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

/** Password used when seeding / when Supabase isn't configured. Change it in the table! */
export function seedKvkPassword(): string {
  return process.env.KVK_SEED_PASSWORD?.trim() || "1241";
}
