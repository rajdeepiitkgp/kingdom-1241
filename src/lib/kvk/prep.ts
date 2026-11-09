// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
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

/**
 * Every second Saturday is a battle day: KvK on the Saturday of each round,
 * the internal castle battle on the Saturdays in between (24 Oct 2026, 21 Nov
 * 2026, …). For a battle the players move into the battle alliances [KvK] and
 * [TMP] (always for KvK, often for the castle battle).
 */
export const BATTLE_EVERY_DAYS = 14;

/** `time` falls on a battle Saturday (UTC date). */
export function isBattleSaturday(time: number): boolean {
  const days = Math.floor((time - (FIRST_PREP_ROUND + 6 * DAY)) / DAY);
  return ((days % BATTLE_EVERY_DAYS) + BATTLE_EVERY_DAYS) % BATTLE_EVERY_DAYS === 0;
}

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

/** The number of a round (0 for the first one shown on the site). */
export function roundIndex(round: PrepRound): number {
  return Math.round((round.start.getTime() - FIRST_PREP_ROUND) / (PREP_CYCLE_DAYS * DAY));
}

/** The round after this one. */
export function nextRound(round: PrepRound): PrepRound {
  return prepRound(roundIndex(round) + 1);
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
export type Marks = readonly [PrepMark, PrepMark, PrepMark, PrepMark, PrepMark];

/**
 * One row of the table: what to use on which of Days 1–5, as every player
 * sees it. The five ministry items (Truegold, Tempered Truegold and
 * construction speedups; Truegold Dust and research speedups) score the same
 * on Days 1, 2 and 5, so they are ✅ on all three here; which of those days
 * the kingdom actually uses is the council's buff schedule (`marksFor`), shown
 * behind the battle plan's password. Everything else is fixed by the game.
 */
export const PREP_ITEMS = [
  { id: "intel", icon: "👀", marks: ["best", "wait", "best", "wait", "best"] },
  { id: "gathering", icon: "🚜", marks: ["wait", "best", "wait", "best", "best"] },
  { id: "truegold", icon: "🪙", marks: ["best", "best", "no", "no", "best"] },
  { id: "temperedTruegold", icon: "🔶", marks: ["best", "best", "no", "no", "best"] },
  { id: "construction", icon: "🏗️", marks: ["best", "best", "no", "no", "best"] },
  { id: "tgDust", icon: "💫", marks: ["best", "best", "no", "no", "best"] },
  { id: "research", icon: "🔬", marks: ["best", "best", "no", "no", "best"] },
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

/**
 * The game's own coding: the days each item scores on, read from the in-game
 * "Point Sources" of every sub-phase (Nov 2026). A test keeps the table above
 * and the council's schedule inside it: a ✅ or 🆗 may only sit on one of these
 * days, a ⚠ never does. Trained troops score per troop on Day 4 only; their
 * speedups score like every other speedup (Days 1, 2 and 5), which the
 * council marks 🚫 on Days 1 and 2 on purpose (keep speedups for the buff days).
 */
export const OFFICIAL_DAYS: Record<PrepItemId, readonly ScoringDay[]> = {
  intel: [1, 3, 5],
  gathering: [2, 4, 5],
  truegold: [1, 2, 5],
  temperedTruegold: [1, 2, 5],
  construction: [1, 2, 5],
  tgDust: [1, 2, 5],
  research: [1, 2, 5],
  masterSkill: [1, 2, 5],
  emblem: [2, 3],
  manuscript: [2, 3],
  roulette: [2, 3],
  shards: [2, 3],
  pets: [3, 5],
  troops: [1, 2, 4, 5],
  charms: [1, 3, 4],
  gear: [5],
  widgets: [4, 5],
  hammers: [4, 5],
  mithril: [4, 5],
};

/**
 * The king gives the construction and the research minister buff on one day
 * each; the training buff always goes to Day 4, where troops score. Both can
 * fall on any day the game scores the items (Days 1, 2 and 5, Friday being the
 * last with the buff), and on the same day.
 */
export type BuffDay = 1 | 2 | 5;
export const BUFF_DAYS: readonly BuffDay[] = [1, 2, 5];
export type Ministry = "construction" | "research";
export const MINISTRIES: readonly Ministry[] = ["construction", "research"];
export type PrepSchedule = Record<Ministry, BuffDay>;

/** What the council usually does; the public page's day names follow it. */
export const TEMPLATE_SCHEDULE: PrepSchedule = { construction: 1, research: 2 };

export const isBuffDay = (value: unknown): value is BuffDay => BUFF_DAYS.includes(value as BuffDay);

/** The three minister buffs as the council's card shows them: the two the council places, and training, Day 4 by the game. */
export type Buff = Ministry | "training";
export const BUFFS: readonly Buff[] = ["construction", "research", "training"];
export const TRAINING_DAY: ScoringDay = 4;

export function buffDay(schedule: PrepSchedule, buff: Buff): ScoringDay {
  return buff === "training" ? TRAINING_DAY : schedule[buff];
}

/** The items whose ✅ follows a ministry buff. */
export const MINISTRY_ITEMS: Record<Ministry, readonly PrepItemId[]> = {
  construction: ["truegold", "temperedTruegold", "construction"],
  research: ["tgDust", "research"],
};

export function ministryOf(id: PrepItemId): Ministry | null {
  return MINISTRIES.find((ministry) => MINISTRY_ITEMS[ministry].includes(id)) ?? null;
}

/**
 * An item's marks for one round: with the council's schedule a ministry item
 * is ✅ on its buff day and 🆗 on the other two scoring days; without one
 * (the public page) the table's own marks.
 */
export function marksFor(item: PrepItem, schedule: PrepSchedule | null): Marks {
  const ministry = schedule && ministryOf(item.id);
  if (!ministry) return item.marks;
  return SCORING_DAYS.map((day) => (day === schedule[ministry] ? "best" : isBuffDay(day) ? "ok" : "no")) as unknown as Marks;
}

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

export function markOn(item: PrepItem, day: ScoringDay, schedule: PrepSchedule | null = null): PrepMark {
  return marksFor(item, schedule)[day - 1];
}

/** First day after `day` with one of the marks, trying them in order (✅ before 🆗), or null. */
function nextDayWith(item: PrepItem, day: PrepDay, marks: readonly PrepMark[], schedule: PrepSchedule | null): ScoringDay | null {
  for (const mark of marks) {
    const next = SCORING_DAYS.find((d) => d > day && markOn(item, d, schedule) === mark);
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

/**
 * The table read for one day, with the council's buff schedule once the page
 * is unlocked. Day 0 scores nothing, so everything waits for Day 1 and later.
 */
export function dayPlan(day: PrepDay, schedule: PrepSchedule | null = null): DayPlan {
  const plan: DayPlan = { best: [], ok: [], wait: [], no: [] };
  if (day === 0) return plan;
  for (const item of PREP_ITEMS) {
    const mark = markOn(item, day, schedule);
    if (mark === "best") plan.best.push(item);
    else if (mark === "ok") plan.ok.push({ item, bestDay: nextDayWith(item, day, ["best"], schedule) });
    else if (mark === "wait") plan.wait.push({ item, day: nextDayWith(item, day, ["best", "ok"], schedule) });
    else plan.no.push({ item, day: nextDayWith(item, day, ["best", "ok"], schedule) });
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
  | "intelSaturday"
  | "bisonSave"
  | "allianceNode"
  | "gatherEarly"
  | "gatherBoost"
  | "gatherRecall"
  | "gatherRecallAgain"
  | "gatherRecallInvasion"
  | "warAcademy"
  | "troopBatch"
  | "troopsFirst"
  | "finalPush"
  | "shield"
  | "homeCoords"
  | "battleNext";

/**
 * The ❗ lines of each day; `day` fills the tip's {day}. Intel stacking has
 * its own card (`INTEL_STACK_STEPS`). Gathering counts on the day the march
 * comes home (Days 2, 4 and 5): the day before, send marches out late enough
 * to return after the reset; on the day, recall them before it ends (Day 4
 * sends them straight out again for Day 5, Day 5 ends at the invasion, where
 * Saturday's early intel batches still count too).
 */
export const PREP_TIPS: Record<PrepDay, ReadonlyArray<{ id: PrepTipId; day?: ScoringDay }>> = {
  0: [],
  1: [{ id: "intelOpen" }, { id: "bisonSave", day: 2 }, { id: "allianceNode" }, { id: "gatherEarly" }, { id: "gatherBoost" }],
  2: [{ id: "gatherRecall" }, { id: "warAcademy" }],
  3: [{ id: "intelOpen" }, { id: "troopBatch", day: 4 }, { id: "bisonSave", day: 4 }, { id: "allianceNode" }, { id: "gatherEarly" }, { id: "gatherBoost" }],
  4: [{ id: "troopsFirst" }, { id: "bisonSave", day: 5 }, { id: "allianceNode" }, { id: "gatherRecallAgain" }, { id: "gatherBoost" }],
  5: [{ id: "intelOpen" }, { id: "intelSaturday" }, { id: "gatherRecallInvasion" }, { id: "finalPush" }, { id: "battleNext" }, { id: "shield" }, { id: "homeCoords" }],
};

/** The tips that go with a ministry's buff day (the template puts them on its day; the schedule moves them). */
const MINISTRY_TIPS: Record<Ministry, readonly PrepTipId[]> = { construction: [], research: ["warAcademy"] };

/** One day's tips: the template's, with each ministry's tips moved to its buff day once the schedule is known. */
export function tipsFor(day: PrepDay, schedule: PrepSchedule | null = null): ReadonlyArray<{ id: PrepTipId; day?: ScoringDay }> {
  if (!schedule) return PREP_TIPS[day];
  const moved = new Set(MINISTRIES.flatMap((ministry) => MINISTRY_TIPS[ministry]));
  const fixed = PREP_TIPS[day].filter((tip) => !moved.has(tip.id));
  const ofDay = MINISTRIES.filter((ministry) => schedule[ministry] === day).flatMap((ministry) => MINISTRY_TIPS[ministry].map((id) => ({ id })));
  return [...fixed, ...ofDay];
}

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
