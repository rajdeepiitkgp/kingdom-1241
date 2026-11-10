// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { type Buff, BUFFS, buffDay, dayStart, FIRST_PREP_ROUND, pointsOn, PREP_CYCLE_DAYS, PREP_POINTS, type PrepItemId, type PrepRound, type PrepSchedule, type ScoringDay, SCORING_DAYS } from "@/lib/kvk/prep";
import { DAY, MINUTE } from "@/lib/time";

/**
 * Ministry appointments (pure, unit-tested): players sign up for the king's
 * buff days of a KvK prep round. The construction and the research buff fall
 * on the days the council set on /admin/prep, training on Day 4; each buff
 * day has 48 half-hour appointments from 00:00 to 24:00 UTC (the council
 * activates the Day 5 buff on Friday, never on Saturday). A player says what
 * they will use and which slots they can take; who scores more goes first.
 *
 * A **section** is one buff day. Construction and research on the same day
 * are one section: one appointment serves both, so one slot picker and one
 * list ranked by the combined score.
 */

export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

/**
 * The length of one button of the player's slot picker. Availability is
 * stored per half-hour slot whatever this says, so changing it to 30 (one
 * button per appointment) or 60 needs no data change.
 */
export const PICK_MINUTES: 30 | 60 | 120 = 120;

/** The picker's buttons: each the half-hour slots it stands for, in day order. */
export function pickBlocks(pickMinutes: number = PICK_MINUTES): number[][] {
  const size = Math.max(1, Math.round(pickMinutes / SLOT_MINUTES));
  const blocks: number[][] = [];
  for (let first = 0; first < SLOTS_PER_DAY; first += size) {
    blocks.push(Array.from({ length: Math.min(size, SLOTS_PER_DAY - first) }, (_, i) => first + i));
  }
  return blocks;
}

export const isSlot = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < SLOTS_PER_DAY;

/** Sorted, without doubles or anything that isn't a slot. */
export function cleanSlots(values: Iterable<unknown>): number[] {
  return [...new Set([...values].filter(isSlot))].sort((a, b) => a - b);
}

/** `"05:00"` for slot 10; slot 48 is `"24:00"`, the end of the last one. */
export function slotClock(slot: number): string {
  const minutes = slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** `"05:00–05:30"`, UTC. */
export function slotLabel(slot: number, length = 1): string {
  return `${slotClock(slot)}–${slotClock(slot + length)}`;
}

/** When a slot of a round's day starts. */
export function slotStart(round: PrepRound, day: ScoringDay, slot: number): Date {
  return new Date(dayStart(round, day).getTime() + slot * SLOT_MINUTES * MINUTE);
}

/** The chosen slots as runs of neighbours: `[4,5,6,7,20]` → `[[4,4],[20,1]]` (first slot, length). */
export function slotRuns(slots: readonly number[]): Array<[first: number, length: number]> {
  const runs: Array<[number, number]> = [];
  for (const slot of cleanSlots(slots)) {
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === slot) last[1] += 1;
    else runs.push([slot, 1]);
  }
  return runs;
}

export interface Section {
  day: ScoringDay;
  /** The buffs given on this day: one, or construction and research together. */
  buffs: Buff[];
}

/** The round's buff days in day order; buffs that share a day share a section. */
export function sectionsFor(schedule: PrepSchedule): Section[] {
  const sections: Section[] = [];
  for (const day of SCORING_DAYS) {
    const buffs = BUFFS.filter((buff) => buffDay(schedule, buff) === day);
    if (buffs.length > 0) sections.push({ day, buffs });
  }
  return sections;
}

export const sectionOn = (sections: readonly Section[], day: number): Section | null => sections.find((section) => section.day === day) ?? null;

/** What a player says they will use; speedups in minutes. */
export interface Amounts {
  truegold: number;
  temperedTruegold: number;
  tgDust: number;
  constructionMinutes: number;
  researchMinutes: number;
  trainingMinutes: number;
}

export const NO_AMOUNTS: Amounts = { truegold: 0, temperedTruegold: 0, tgDust: 0, constructionMinutes: 0, researchMinutes: 0, trainingMinutes: 0 };

export type ResourceField = "truegold" | "temperedTruegold" | "tgDust";
export type SpeedupField = "constructionMinutes" | "researchMinutes" | "trainingMinutes";

/** The fields each buff asks for: its resources, and its speedups. */
export const BUFF_FIELDS: Record<Buff, { resources: readonly ResourceField[]; speedups: SpeedupField }> = {
  construction: { resources: ["truegold", "temperedTruegold"], speedups: "constructionMinutes" },
  research: { resources: ["tgDust"], speedups: "researchMinutes" },
  training: { resources: [], speedups: "trainingMinutes" },
};

/** The largest numbers the form takes: far above what anyone holds, small enough to rule out a slip of ten digits. */
export const AMOUNT_MAX: Record<ResourceField, number> = { truegold: 5_000_000, temperedTruegold: 500_000, tgDust: 10_000_000 };
export const SPEEDUP_DAYS_MAX = 2000;
export const SPEEDUP_MINUTES_MAX = SPEEDUP_DAYS_MAX * 24 * 60 + 23 * 60;

/** The prep page's points for one unit of an item (`each`, `perMinute`); 0 for items scored another way. */
function unitPoints(id: PrepItemId): number {
  const points = PREP_POINTS[id];
  return points && "n" in points ? points.n : 0;
}

/** Training is ranked by speedups: the more a player has, the more troops they train. The game scores a minute of them like any speedup. */
function trainingPointsPerMinute(): number {
  const points = pointsOn("troops", 5);
  return points && "n" in points ? points.n : unitPoints("construction");
}

/** The KvK points a player's numbers for one buff are worth, with the prep page's own table. */
export function buffScore(buff: Buff, amounts: Amounts): number {
  if (buff === "construction") {
    return amounts.truegold * unitPoints("truegold") + amounts.temperedTruegold * unitPoints("temperedTruegold") + amounts.constructionMinutes * unitPoints("construction");
  }
  if (buff === "research") return amounts.tgDust * unitPoints("tgDust") + amounts.researchMinutes * unitPoints("research");
  return amounts.trainingMinutes * trainingPointsPerMinute();
}

/** A section's score: its buffs together (construction and research on one day count as one). */
export function sectionScore(section: Section, amounts: Amounts): number {
  return section.buffs.reduce((sum, buff) => sum + buffScore(buff, amounts), 0);
}

/** The slots a player can take, per buff day (`{ "1": [0, 1, 2, 3] }`). A day without slots is a day they sit out. */
export type SlotChoice = Partial<Record<ScoringDay, number[]>>;

export interface Signup {
  id: string;
  /** The round's Day 0 as a UTC date (`roundKey`). */
  round: string;
  governorId: string;
  gameName: string;
  allianceTag: string | null;
  /** Name and alliance came from MightPulse. */
  verified: boolean;
  /** Power as MightPulse reported it at sign-up, when it did. */
  power: number | null;
  amounts: Amounts;
  slots: SlotChoice;
  /** A moderator set it aside: kept, but left out of the lists and the assignment. */
  disabled: boolean;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

const whole = (value: unknown, max: number): number => {
  const n = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : 0;
};

/** The stored amounts as the site reads them: anything missing or odd counts as 0. */
export function parseAmounts(value: unknown): Amounts {
  const stored = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return {
    truegold: whole(stored.truegold, AMOUNT_MAX.truegold),
    temperedTruegold: whole(stored.temperedTruegold, AMOUNT_MAX.temperedTruegold),
    tgDust: whole(stored.tgDust, AMOUNT_MAX.tgDust),
    constructionMinutes: whole(stored.constructionMinutes, SPEEDUP_MINUTES_MAX),
    researchMinutes: whole(stored.researchMinutes, SPEEDUP_MINUTES_MAX),
    trainingMinutes: whole(stored.trainingMinutes, SPEEDUP_MINUTES_MAX),
  };
}

/** The stored slot choice: scoring days only, clean slot lists, empty days left out. */
export function parseSlotChoice(value: unknown): SlotChoice {
  const stored = typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const choice: SlotChoice = {};
  for (const day of SCORING_DAYS) {
    const slots = Array.isArray(stored[day]) ? cleanSlots(stored[day] as unknown[]) : [];
    if (slots.length > 0) choice[day] = slots;
  }
  return choice;
}

/** The player takes part in this section: they picked at least one of its slots. */
export const joined = (signup: Pick<Signup, "slots">, section: Section): boolean => (signup.slots[section.day]?.length ?? 0) > 0;

/** Speedup minutes as the form shows them. */
export function splitSpeedup(minutes: number): { days: number; hours: number } {
  const hours = Math.floor(minutes / 60);
  return { days: Math.floor(hours / 24), hours: hours % 24 };
}

export const speedupMinutes = (days: number, hours: number): number => (days * 24 + hours) * 60;

/** One line of a section's list: the sign-up and what it scores there. */
export interface RankedSignup<T extends Signup = Signup> {
  signup: T;
  score: number;
}

/**
 * A section's sign-ups, highest score first; on equal scores whoever signed
 * up first. Disabled entries and players who sit the day out are left out.
 */
export function rankSection<T extends Signup>(signups: readonly T[], section: Section): RankedSignup<T>[] {
  return signups
    .filter((signup) => !signup.disabled && joined(signup, section))
    .map((signup) => ({ signup, score: sectionScore(section, signup.amounts) }))
    .sort((a, b) => b.score - a.score || a.signup.createdAt.localeCompare(b.signup.createdAt) || a.signup.id.localeCompare(b.signup.id));
}

/** How many of a section's players can take each slot (48 numbers): where the day is thin. */
export function slotDemand(ranked: readonly RankedSignup[], day: ScoringDay): number[] {
  const demand = Array.from({ length: SLOTS_PER_DAY }, () => 0);
  for (const { signup } of ranked) for (const slot of signup.slots[day] ?? []) demand[slot] += 1;
  return demand;
}

// ── The round's settings: open or not, and a deadline per buff day ────────────

/** The deadline a day gets when the council sets none: a day before it starts. */
export const DEFAULT_DEADLINE_LEAD = DAY;

export interface RoundSettings {
  /** Moderators opened the sign-ups of this round. */
  open: boolean;
  /** Per buff day, an ISO time; a day without one gets the default. */
  deadlines: Partial<Record<ScoringDay, string>>;
}

/** Per round key (`"2026-11-29"`). */
export type MinistrySettings = Record<string, RoundSettings>;

const ROUND_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The app_config value `{ rounds: { "<Day 0 date>": { open, deadlines: { "1": iso } } } }`, read tolerantly. */
export function parseMinistrySettings(value: unknown): MinistrySettings {
  const stored = typeof value === "object" && value !== null ? (value as { rounds?: unknown }).rounds : null;
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
  const rounds: MinistrySettings = {};
  for (const [key, entry] of Object.entries(stored as Record<string, unknown>)) {
    if (!ROUND_KEY.test(key) || typeof entry !== "object" || entry === null) continue;
    const raw = entry as { open?: unknown; deadlines?: unknown };
    const deadlines: RoundSettings["deadlines"] = {};
    const given = typeof raw.deadlines === "object" && raw.deadlines !== null ? (raw.deadlines as Record<string, unknown>) : {};
    for (const day of SCORING_DAYS) {
      const iso = given[day];
      if (typeof iso === "string" && !Number.isNaN(Date.parse(iso))) deadlines[day] = new Date(iso).toISOString();
    }
    rounds[key] = { open: raw.open === true, deadlines };
  }
  return onlyOneOpen(rounds);
}

export const CLOSED_ROUND: RoundSettings = { open: false, deadlines: {} };

export function defaultDeadline(round: PrepRound, day: ScoringDay): Date {
  return new Date(dayStart(round, day).getTime() - DEFAULT_DEADLINE_LEAD);
}

/** A buff day's deadline: the council's, else a day before it starts. */
export function deadlineFor(settings: RoundSettings, round: PrepRound, day: ScoringDay): Date {
  const set = settings.deadlines[day];
  return set ? new Date(set) : defaultDeadline(round, day);
}

/** The latest a deadline may be: when the day starts (the first appointment). */
export const latestDeadline = (round: PrepRound, day: ScoringDay): Date => dayStart(round, day);

/**
 * The value to store after a save: the new entry, every round from the
 * current one on, nothing older. **One round is open at a time** (the owner's
 * rule: two open rounds confuse): opening a round closes every other one,
 * which keeps its deadlines and its entries.
 */
export function withRoundSettings(rounds: MinistrySettings, key: string, settings: RoundSettings, currentKey: string): { rounds: MinistrySettings } {
  const kept = Object.fromEntries(
    Object.entries(rounds)
      .filter(([k]) => k >= currentKey && k !== key)
      .map(([k, other]) => [k, settings.open && other.open ? { ...other, open: false } : other]),
  );
  return { rounds: { ...kept, [key]: settings } };
}

/** The rounds other than `key` that a save opening it would close. */
export function roundsClosedBy(rounds: MinistrySettings, key: string, settings: RoundSettings, currentKey: string): string[] {
  if (!settings.open) return [];
  return Object.keys(rounds).filter((k) => k >= currentKey && k !== key && rounds[k].open);
}

/** At most one round counts as open: of several stored as open (saved before the rule), the earliest. */
export function onlyOneOpen(rounds: MinistrySettings): MinistrySettings {
  const first = Object.keys(rounds).sort().find((k) => rounds[k].open);
  return Object.fromEntries(Object.entries(rounds).map(([k, round]) => [k, round.open && k !== first ? { ...round, open: false } : round]));
}

export type SectionState = "open" | "closed";

/** Sign-ups for a day are open until its deadline. */
export function sectionState(now: Date, deadline: Date): SectionState {
  return now.getTime() < deadline.getTime() ? "open" : "closed";
}

/** The last appointment of the round is over: nothing left to show or change. */
export function roundOver(now: Date, round: PrepRound, sections: readonly Section[]): boolean {
  const last = sections[sections.length - 1];
  return last === undefined || now.getTime() >= dayStart(round, last.day).getTime() + DAY;
}

/** How long sign-ups are kept after the round's battle before the prune deletes them. */
export const KEEP_AFTER_ROUND = 14 * DAY;

/** At most this many sign-ups per round: far above the kingdom's players, a lid on a flood. */
export const MAX_SIGNUPS_PER_ROUND = 600;

/** A round's sign-ups are due for deletion: two weeks after its week (Day 0 + 7 days) ended. */
export function roundDue(roundStart: Date, now: Date): boolean {
  return now.getTime() >= roundStart.getTime() + 7 * DAY + KEEP_AFTER_ROUND;
}

/** The key of the newest round whose sign-ups are due for deletion at `now`, or null while none is. */
export function latestDueRound(now: Date): string | null {
  const index = Math.floor((now.getTime() - 7 * DAY - KEEP_AFTER_ROUND - FIRST_PREP_ROUND) / (PREP_CYCLE_DAYS * DAY));
  return index < 0 ? null : new Date(FIRST_PREP_ROUND + index * PREP_CYCLE_DAYS * DAY).toISOString().slice(0, 10);
}

export type RoundSettingsFormResult = { ok: true; value: { round: string; settings: RoundSettings } } | { ok: false; errors: Record<string, string> };

/**
 * The admin form of one round: `open` and a UTC deadline per buff day
 * (`deadline.<day>`, `YYYY-MM-DDTHH:mm`; empty = the default). A deadline may
 * not lie after the start of its day.
 */
export function parseRoundSettingsForm(form: { get(name: string): unknown }, rounds: ReadonlyArray<{ key: string; round: PrepRound; sections: readonly Section[] }>): RoundSettingsFormResult {
  const errors: Record<string, string> = {};
  const key = String(form.get("round") ?? "");
  const offered = rounds.find((entry) => entry.key === key);
  if (!offered) return { ok: false, errors: { round: "Pick one of the rounds shown." } };
  const deadlines: RoundSettings["deadlines"] = {};
  for (const { day } of offered.sections) {
    const raw = String(form.get(`deadline.${day}`) ?? "").trim();
    if (!raw) continue;
    const time = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? Date.parse(`${raw}:00Z`) : Number.NaN;
    if (Number.isNaN(time)) errors[`deadline.${day}`] = "Pick a date and time.";
    else if (time > latestDeadline(offered.round, day).getTime()) errors[`deadline.${day}`] = "The deadline can't be after the day starts (00:00 UTC).";
    else if (time !== defaultDeadline(offered.round, day).getTime()) deadlines[day] = new Date(time).toISOString();
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const open = form.get("open") === "on" || form.get("open") === "1";
  return { ok: true, value: { round: key, settings: { open, deadlines } } };
}

/** `"3 d 4 h"` for the admin list. */
export function speedupLabel(minutes: number): string {
  const { days, hours } = splitSpeedup(minutes);
  return days > 0 && hours > 0 ? `${days} d ${hours} h` : days > 0 ? `${days} d` : `${hours} h`;
}
