import { DAY, HOUR } from "@/lib/time";
import { STANDARD_BATTLE } from "./battle-window";

/**
 * The KvK preparation week and the council's item × day table (pure,
 * unit-tested, shared by the public /kvk/prep page and the Home card).
 *
 * A round repeats every four weeks. Sunday is Day 0 (no scoring: save the
 * 16:00 UTC intel missions for Day 1), Monday to Thursday are Days 1–4
 * (00:00–24:00 UTC), Day 5 runs from Friday 00:00 UTC until the invasion
 * begins on Saturday at 10:00 UTC. Shields stay up 10:00–22:00 UTC; only the
 * players fighting the castle battle (12:00–17:00 UTC) drop theirs for it.
 * The schedule is fixed here on purpose: it hardly ever changes, and a change
 * goes through a PR like the texts.
 */

/** Day 0 (Sunday 00:00 UTC) of the first round shown on the site. */
export const FIRST_PREP_ROUND = Date.UTC(2026, 10, 1);
export const PREP_CYCLE_DAYS = 28;
/** Saturday hours (UTC): Day 5 ends and the invasion begins, the castle battle, the end of the shield window. */
export const KVK_SATURDAY = {
  invasionHour: 10,
  battleStartHour: STANDARD_BATTLE.startHourUtc,
  battleEndHour: STANDARD_BATTLE.endHourUtc,
  shieldEndHour: 22,
} as const;

export type PrepDay = 0 | 1 | 2 | 3 | 4 | 5;
export type ScoringDay = Exclude<PrepDay, 0>;
export const PREP_DAYS: readonly PrepDay[] = [0, 1, 2, 3, 4, 5];
export const SCORING_DAYS: readonly ScoringDay[] = [1, 2, 3, 4, 5];

export interface PrepRound {
  /** Day 0, Sunday 00:00 UTC. */
  start: Date;
  /** End of Day 5: the invasion begins and shields go up. */
  invasionAt: Date;
  battleAt: Date;
  battleEndAt: Date;
  /** Shields may come down; the round is over. */
  shieldEndAt: Date;
}

export function prepRound(index: number): PrepRound {
  const start = FIRST_PREP_ROUND + index * PREP_CYCLE_DAYS * DAY;
  const saturday = (hour: number) => new Date(start + 6 * DAY + hour * HOUR);
  return {
    start: new Date(start),
    invasionAt: saturday(KVK_SATURDAY.invasionHour),
    battleAt: saturday(KVK_SATURDAY.battleStartHour),
    battleEndAt: saturday(KVK_SATURDAY.battleEndHour),
    shieldEndAt: saturday(KVK_SATURDAY.shieldEndHour),
  };
}

/** The round in progress, or the next one once its shield window is over. */
export function roundFor(now: Date): PrepRound {
  const index = Math.floor((now.getTime() - FIRST_PREP_ROUND) / (PREP_CYCLE_DAYS * DAY));
  const round = prepRound(index);
  return now.getTime() < round.shieldEndAt.getTime() ? round : prepRound(index + 1);
}

export function dayStart(round: PrepRound, day: PrepDay): Date {
  return new Date(round.start.getTime() + day * DAY);
}

export function dayEnd(round: PrepRound, day: PrepDay): Date {
  return day === 5 ? round.invasionAt : dayStart(round, (day + 1) as PrepDay);
}

export type PrepPhase =
  | { kind: "before"; until: Date }
  | { kind: "day"; day: PrepDay; until: Date }
  | { kind: "invasion"; until: Date }
  | { kind: "battle"; until: Date }
  | { kind: "afterBattle"; until: Date };

/**
 * Where `now` falls in its round; `until` is the end of that phase. Before the
 * round it is the start of Day 1: prep proper begins on Monday, and the
 * get-ready Sunday (Day 0) is part of the wait.
 */
export function prepPhase(now: Date, round: PrepRound = roundFor(now)): PrepPhase {
  const t = now.getTime();
  if (t < round.start.getTime()) return { kind: "before", until: dayStart(round, 1) };
  for (const day of PREP_DAYS) {
    const end = dayEnd(round, day);
    if (t < end.getTime()) return { kind: "day", day, until: end };
  }
  if (t < round.battleAt.getTime()) return { kind: "invasion", until: round.battleAt };
  if (t < round.battleEndAt.getTime()) return { kind: "battle", until: round.battleEndAt };
  return { kind: "afterBattle", until: round.shieldEndAt };
}

/** One day's own countdown: to its start while ahead, to its end while running, and its end once over. */
export function dayCountdown(round: PrepRound, day: PrepDay, now: Date): { state: "upcoming" | "live" | "done"; at: Date } {
  const start = dayStart(round, day);
  const end = dayEnd(round, day);
  if (now.getTime() < start.getTime()) return { state: "upcoming", at: start };
  return { state: now.getTime() < end.getTime() ? "live" : "done", at: end };
}

/** The day the page opens on: today, else the next day of the round (Day 0 between rounds, Day 5 on battle day). */
export function defaultDay(phase: PrepPhase): PrepDay {
  if (phase.kind === "day") return phase.day;
  return phase.kind === "before" ? 0 : 5;
}

/** ✅ best day · 🆗 counts · ⚠ wait (prepare for the next day) · 🚫 don't use. */
export type PrepMark = "best" | "ok" | "wait" | "no";
type Marks = readonly [PrepMark, PrepMark, PrepMark, PrepMark, PrepMark];

/** One row of the table: what to use on which of Days 1–5 (the council's KvK prep template). */
export const PREP_ITEMS = [
  { id: "intel", icon: "👀", marks: ["best", "wait", "best", "wait", "best"] },
  { id: "gathering", icon: "🚜", marks: ["wait", "best", "wait", "best", "best"] },
  { id: "truegold", icon: "🪙", marks: ["best", "ok", "no", "no", "ok"] },
  { id: "temperedTruegold", icon: "🔶", marks: ["best", "ok", "no", "no", "ok"] },
  { id: "construction", icon: "🏗️", marks: ["best", "ok", "no", "no", "ok"] },
  { id: "tgDust", icon: "💫", marks: ["ok", "best", "no", "no", "ok"] },
  { id: "research", icon: "🔬", marks: ["ok", "best", "no", "no", "ok"] },
  { id: "masterSkill", icon: "🎓", marks: ["ok", "best", "no", "no", "best"] },
  { id: "emblem", icon: "🔷", marks: ["no", "best", "ok", "no", "no"] },
  { id: "manuscript", icon: "📘", marks: ["no", "best", "ok", "no", "no"] },
  { id: "roulette", icon: "🎰", marks: ["no", "best", "best", "no", "no"] },
  { id: "shards", icon: "🧩", marks: ["no", "best", "best", "no", "no"] },
  { id: "pets", icon: "🐶", marks: ["no", "no", "best", "no", "best"] },
  { id: "troops", icon: "⚔️", marks: ["no", "no", "no", "best", "ok"] },
  { id: "charms", icon: "💠", marks: ["best", "no", "best", "best", "no"] },
  { id: "gear", icon: "👔", marks: ["no", "no", "no", "no", "best"] },
  { id: "widgets", icon: "✨", marks: ["no", "no", "no", "ok", "best"] },
  { id: "hammers", icon: "🔨", marks: ["no", "no", "no", "ok", "best"] },
  { id: "mithril", icon: "🪨", marks: ["no", "no", "no", "ok", "best"] },
] as const satisfies ReadonlyArray<{ id: string; icon: string; marks: Marks }>;

export type PrepItem = (typeof PREP_ITEMS)[number];
export type PrepItemId = PrepItem["id"];

/** How an item scores: per unit, per intel mission, per Roulette spin, per +1 Charm/Gear/pet score, per minute of speedup, … */
export type PrepPoints =
  | { kind: "each" | "perMission" | "perSpin" | "perScore" | "perMinute"; n: number }
  | { kind: "perTroop"; min: number; max: number }
  | { kind: "shards"; mythic: number; epic: number; rare: number }
  | { kind: "pets"; advanced: number; common: number; advancement: number }
  | { kind: "gathering"; n: number; bread: number; stone: number; iron: number };

/**
 * Points per use from the council's "points per day" sheet, checked against
 * kingshotdata.com's Kingdom of Power page (which adds Truegold Dust,
 * manuscripts and gathering). An item scores the same on every day it counts,
 * except where `pointsOn` says otherwise.
 */
export const PREP_POINTS: Partial<Record<PrepItemId, PrepPoints>> = {
  intel: { kind: "perMission", n: 6000 },
  gathering: { kind: "gathering", n: 2, bread: 1000, stone: 200, iron: 50 },
  truegold: { kind: "each", n: 2000 },
  temperedTruegold: { kind: "each", n: 30000 },
  construction: { kind: "perMinute", n: 30 },
  tgDust: { kind: "each", n: 1000 },
  research: { kind: "perMinute", n: 30 },
  masterSkill: { kind: "perMinute", n: 30 },
  emblem: { kind: "each", n: 6000 },
  manuscript: { kind: "each", n: 60 },
  roulette: { kind: "perSpin", n: 8000 },
  shards: { kind: "shards", mythic: 3040, epic: 1220, rare: 350 },
  pets: { kind: "pets", advanced: 15000, common: 1150, advancement: 50 },
  troops: { kind: "perTroop", min: 3, max: 75 },
  charms: { kind: "perScore", n: 70 },
  gear: { kind: "perScore", n: 36 },
  widgets: { kind: "each", n: 8000 },
  hammers: { kind: "each", n: 4000 },
  mithril: { kind: "each", n: 40000 },
};

/** Trained troops count per troop on Day 4 only; on Day 5 only their speedups score. */
const POINTS_ON_DAY: Partial<Record<PrepItemId, Partial<Record<ScoringDay, PrepPoints>>>> = {
  troops: { 5: { kind: "perMinute", n: 30 } },
};

export function pointsOn(id: PrepItemId, day: ScoringDay): PrepPoints | undefined {
  return POINTS_ON_DAY[id]?.[day] ?? PREP_POINTS[id];
}

export function markOn(item: PrepItem, day: ScoringDay): PrepMark {
  return item.marks[day - 1];
}

/** First day after `day` with one of the marks, trying them in order (✅ before 🆗), or null. */
function nextDayWith(item: PrepItem, day: PrepDay, marks: readonly PrepMark[]): ScoringDay | null {
  for (const mark of marks) {
    const next = SCORING_DAYS.find((d) => d > day && markOn(item, d) === mark);
    if (next) return next;
  }
  return null;
}

export interface DayPlan {
  best: PrepItem[];
  /** Counts today; `bestDay` when a later day of the round is better. */
  ok: Array<{ item: PrepItem; bestDay: ScoringDay | null }>;
  /** Get ready today for a later day (the tips say how). */
  wait: Array<{ item: PrepItem; day: ScoringDay | null }>;
  /** Don't use today; `day` is when it counts next in this round (null: keep it for the next round). */
  no: Array<{ item: PrepItem; day: ScoringDay | null }>;
}

/** The table read for one day. Day 0 scores nothing, so everything waits for Day 1 and later. */
export function dayPlan(day: PrepDay): DayPlan {
  const plan: DayPlan = { best: [], ok: [], wait: [], no: [] };
  if (day === 0) return plan;
  for (const item of PREP_ITEMS) {
    const mark = markOn(item, day);
    if (mark === "best") plan.best.push(item);
    else if (mark === "ok") plan.ok.push({ item, bestDay: nextDayWith(item, day, ["best"]) });
    else if (mark === "wait") plan.wait.push({ item, day: nextDayWith(item, day, ["best", "ok"]) });
    else plan.no.push({ item, day: nextDayWith(item, day, ["best", "ok"]) });
  }
  return plan;
}

/**
 * Intel stacking on the day before an intel day (UTC hours of that day; 24 is
 * the next day's reset): clear the 00:00 batch, finish the 08:00 batch without
 * claiming it, leave the 16:00 batch (and Master Pan's extra missions) open,
 * and cash all of it in when the intel day starts.
 */
export const INTEL_STACK_STEPS = [
  { id: "clear", hour: 0, complete: true, claim: true },
  { id: "keepRewards", hour: 8, complete: true, claim: false },
  { id: "keepMissions", hour: 16, complete: false, claim: false },
  { id: "open", hour: 24, complete: true, claim: true },
] as const;

/** The intel day that `day` stacks missions for (the next day, when intel is ✅ there), or null. */
export function intelStackFor(day: PrepDay): ScoringDay | null {
  const next = day + 1;
  if (next > 5) return null;
  const intel = PREP_ITEMS.find((item) => item.id === "intel");
  return intel && markOn(intel, next as ScoringDay) === "best" ? (next as ScoringDay) : null;
}

export type PrepTipId =
  | "intelOpen"
  | "bisonSave"
  | "allianceNode"
  | "gatherEarly"
  | "gatherBoost"
  | "warAcademy"
  | "troopBatch"
  | "troopsFirst"
  | "finalPush"
  | "shield"
  | "homeCoords"
  | "battleNext";

/** The ❗ lines of each day; `day` fills the tip's {day}. Intel stacking has its own card (`INTEL_STACK_STEPS`). */
export const PREP_TIPS: Record<PrepDay, ReadonlyArray<{ id: PrepTipId; day?: ScoringDay }>> = {
  0: [],
  1: [{ id: "intelOpen" }, { id: "bisonSave", day: 2 }, { id: "allianceNode" }, { id: "gatherEarly" }, { id: "gatherBoost" }],
  2: [{ id: "warAcademy" }],
  3: [{ id: "intelOpen" }, { id: "troopBatch", day: 4 }, { id: "bisonSave", day: 4 }, { id: "allianceNode" }, { id: "gatherEarly" }, { id: "gatherBoost" }],
  4: [{ id: "troopsFirst" }, { id: "bisonSave", day: 5 }, { id: "allianceNode" }, { id: "gatherEarly" }, { id: "gatherBoost" }],
  5: [{ id: "intelOpen" }, { id: "finalPush" }, { id: "battleNext" }, { id: "shield" }, { id: "homeCoords" }],
};

/** The council's "save these for KvK" reminder, shown between rounds too. */
export const SAVE_FOR_KVK = [
  { id: "manuscripts", icon: "📘" },
  { id: "emblems", icon: "🔷" },
  { id: "speedups", icon: "⏩" },
  { id: "gems", icon: "💎" },
  { id: "truegold", icon: "🪙" },
  { id: "shards", icon: "🧩" },
  { id: "widgets", icon: "✨" },
  { id: "pets", icon: "🐶" },
  { id: "governor", icon: "👕" },
  { id: "hammers", icon: "🔨" },
] as const;

export type SaveItemId = (typeof SAVE_FOR_KVK)[number]["id"];
