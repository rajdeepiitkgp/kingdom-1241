import type { CoordinatorTeam, KvkLeaderRule, KvkRallyLeader, LeaderAudience } from "@/lib/data/types";
import { MINUTE } from "@/lib/time";

/** Pure helpers for the rally-leader page (no React, unit-tested). */

/** A rally with its number on the page (1-based, in the council's order), so the overview and the cards agree. */
export interface NumberedRally {
  rally: KvkRallyLeader;
  number: number;
}

const TEAM_ORDER: CoordinatorTeam[] = ["kvk", "tmp"];
const AUDIENCE_ORDER: LeaderAudience[] = ["all", "rally", "garrison"];

/** Rallies grouped by battle team ([KvK] first, then [TMP]); empty teams are left out. */
export function ralliesByTeam(rallies: KvkRallyLeader[]): Array<{ team: CoordinatorTeam; rallies: NumberedRally[] }> {
  const numbered = rallies.map((rally, index) => ({ rally, number: index + 1 }));
  return TEAM_ORDER.map((team) => ({ team, rallies: numbered.filter((n) => n.rally.team === team) })).filter((group) => group.rallies.length > 0);
}

/** Leader instructions grouped by audience (every leader, rally leads, garrison leads); empty groups are left out. */
export function rulesByAudience(rules: KvkLeaderRule[]): Array<{ audience: LeaderAudience; rules: KvkLeaderRule[] }> {
  return AUDIENCE_ORDER.map((audience) => ({ audience, rules: rules.filter((r) => r.audience === audience) })).filter((group) => group.rules.length > 0);
}

/** Activated pets boost the troops for this long; the council spreads the activations over the battle. */
export const PET_BOOST_MINUTES = 120;

/** The latest pets start (minutes after the battle start) whose whole boost still falls inside a battle of this length. */
export function latestPetsOffset(battleLengthMinutes: number): number {
  return Math.max(0, battleLengthMinutes - PET_BOOST_MINUTES);
}

/** When the boost of pets activated at this offset runs, or null without a battle time or without pets. */
export function petsWindow(battleAt: string | null, offsetMinutes: number | null): { from: Date; to: Date } | null {
  const from = petsMoment(battleAt, offsetMinutes);
  return from ? { from, to: new Date(from.getTime() + PET_BOOST_MINUTES * MINUTE) } : null;
}

/** When a leader activates pets: the battle start plus the offset, or null without a battle time or without pets. */
export function petsMoment(battleAt: string | null, offsetMinutes: number | null): Date | null {
  if (offsetMinutes === null || !battleAt) return null;
  const start = Date.parse(battleAt);
  return Number.isNaN(start) ? null : new Date(start + offsetMinutes * MINUTE);
}

/** "2 hrs", "1 hrs 30 min", "45 min" with the dictionary's unit words. */
export function offsetLabel(minutes: number, units: { hours: string; minutes: string }): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${units.hours}`);
  if (m > 0 || h === 0) parts.push(`${m} ${units.minutes}`);
  return parts.join(" ");
}
