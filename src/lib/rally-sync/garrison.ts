// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { NAME_MAX } from "./room";
import { MAX_MARCH_SECONDS, secondsUntil, type SoundCue } from "./timing";

/**
 * Garrison refills (pure, unit-tested): a room in "garrison" mode times the
 * defenders' refill marches so they land between two enemy rally hits on the
 * castle. A refill that arrives while the garrison is still full turns back;
 * one that arrives after the next hit is too late. Moments are milliseconds
 * since the epoch on the game clock, durations whole seconds:
 *
 *   launch     = the coordinator's tap + the countdown the game showed then
 *   enemy hit  = launch + that enemy leader's march (recorded from earlier hits)
 *   refill     = a moment strictly between two hits, at most 3 s after the first
 *   send       = refill − the player's own march (later sends catch up with a speedup)
 *
 * The coordinator keeps the enemy rally leaders and the incoming rallies in the
 * room (one JSON column, migration 0015); every player's page works out its own
 * send times from its own march time, which never leaves the device.
 */

const SECOND = 1000;

export const MAX_ENEMIES = 12;
export const MAX_ENEMY_RALLIES = 10;
/** The countdown buttons: what the enemy rally's countdown shows when the coordinator taps (seconds before it launches). */
export const LAUNCH_CHIPS: readonly number[] = [285, 270, 255, 240, 225, 210, 195, 180];
export const MAX_NUDGE_SECONDS = 10;
/** A wave clears itself this long after its last rally landed, so the next one starts on an empty list. */
export const WAVE_CLEAR_SECONDS = 30;
/** A refill aims at most this long after the hit before it: the garrison should be full again as soon as it can be. */
export const MAX_REFILL_DELAY_SECONDS = 3;
/** How quickly a player can send one march after another (their setting; later refills catch up with a speedup). */
export const DEFAULT_SEND_SPACING_SECONDS = 5;
export const MIN_SEND_SPACING_SECONDS = 1;
export const MAX_SEND_SPACING_SECONDS = 30;
/** A tap moment sent by the coordinator's page must be this close to the server's clock, else the server's own "now" counts. */
export const MAX_TAP_SKEW_MS = 10_000;
/** A rally whose predicted hit is longer ago than this has landed (a "lands in" then starts a new one). */
const LANDED_SLACK_MS = 60_000;
/** How long players see "updated" on a refill after the coordinator moved one of its hits. */
export const UPDATED_FLAG_SECONDS = 20;

export interface EnemyLeader {
  id: string;
  name: string;
  /** March to our castle in seconds, recorded from earlier hits. */
  marchSeconds: number;
  /** Rallies this time; inactive leaders are hidden from the quick-pick buttons. */
  active: boolean;
  /** The march time before the last change (pets speed a leader up for two hours), with when it changed. */
  previousMarchSeconds: number | null;
  marchChangedAt: string | null;
}

export interface EnemyRally {
  id: string;
  enemyId: string;
  /** Copied from the leader when marked, so editing the list never moves a rally under the players. */
  name: string;
  marchSeconds: number;
  /** When the rally launches (ISO, game clock). */
  launchAt: string;
  /** When the coordinator last moved it after marking (players see "updated"); null if never. */
  movedAt: string | null;
}

export interface GarrisonState {
  enemies: EnemyLeader[];
  rallies: EnemyRally[];
}

export const EMPTY_GARRISON: GarrisonState = { enemies: [], rallies: [] };

// ---------------------------------------------------------------------------
// The stored column (tolerant: anything malformed is dropped)
// ---------------------------------------------------------------------------

const ID = /^[A-Za-z0-9-]{1,40}$/;
const isMarch = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_MARCH_SECONDS;
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isName = (v: unknown): v is string => typeof v === "string" && v.length >= 1 && v.length <= NAME_MAX;
const record = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null);

function parseEnemy(value: unknown): EnemyLeader | null {
  const e = record(value);
  if (!e || typeof e.id !== "string" || !ID.test(e.id) || !isName(e.name) || !isMarch(e.marchSeconds)) return null;
  return {
    id: e.id,
    name: e.name,
    marchSeconds: e.marchSeconds,
    active: e.active !== false,
    previousMarchSeconds: isMarch(e.previousMarchSeconds) ? e.previousMarchSeconds : null,
    marchChangedAt: isTime(e.marchChangedAt) ? e.marchChangedAt : null,
  };
}

function parseRally(value: unknown): EnemyRally | null {
  const r = record(value);
  if (!r || typeof r.id !== "string" || !ID.test(r.id) || typeof r.enemyId !== "string" || !isName(r.name) || !isMarch(r.marchSeconds) || !isTime(r.launchAt)) return null;
  return { id: r.id, enemyId: r.enemyId, name: r.name, marchSeconds: r.marchSeconds, launchAt: r.launchAt, movedAt: isTime(r.movedAt) ? r.movedAt : null };
}

export function parseGarrison(value: unknown): GarrisonState {
  const v = record(value);
  if (!v) return EMPTY_GARRISON;
  const list = <T>(items: unknown, parse: (item: unknown) => T | null, max: number): T[] =>
    (Array.isArray(items) ? items : []).map(parse).filter((item): item is T => item !== null).slice(0, max);
  return { enemies: list(v.enemies, parseEnemy, MAX_ENEMIES), rallies: list(v.rallies, parseRally, MAX_ENEMY_RALLIES) };
}

// ---------------------------------------------------------------------------
// Hits, waves and refill windows
// ---------------------------------------------------------------------------

export function rallyHit(rally: Pick<EnemyRally, "launchAt" | "marchSeconds">): number {
  return Date.parse(rally.launchAt) + rally.marchSeconds * SECOND;
}

export function hasLaunched(rally: Pick<EnemyRally, "launchAt">, now: number): boolean {
  return Date.parse(rally.launchAt) <= now;
}

/** The incoming rallies, earliest hit first, while the wave is on: once the last one landed WAVE_CLEAR_SECONDS ago, none. */
export function currentWave<T extends Pick<EnemyRally, "launchAt" | "marchSeconds">>(rallies: readonly T[], now: number): T[] {
  if (rallies.length === 0) return [];
  const sorted = [...rallies].sort((a, b) => rallyHit(a) - rallyHit(b));
  return now < rallyHit(sorted[sorted.length - 1]) + WAVE_CLEAR_SECONDS * SECOND ? sorted : [];
}

/**
 * The moment the coordinator tapped, as their page measured it on the game
 * clock (so the network's delay doesn't count), if it is close to the
 * server's own "now"; otherwise the server's.
 */
export function tapMoment(tappedAt: unknown, now: number): number {
  return typeof tappedAt === "number" && Number.isFinite(tappedAt) && Math.abs(tappedAt - now) <= MAX_TAP_SKEW_MS ? tappedAt : now;
}

/** A whole number of seconds within min…max from a request, else null. */
export function secondsInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** The launch moment from the coordinator's tap: tap + the countdown the game showed, on the whole second (absorbs the reaction time). */
export function launchFromTap(tappedAt: number, countdownSeconds: number): number {
  return Math.round((tappedAt + countdownSeconds * SECOND) / SECOND) * SECOND;
}

export interface RefillWindow {
  /** The hit before (the garrison has just been hit) and the one after (the refill must be in by then). */
  after: number;
  before: number;
  /** Where the refills aim: strictly between, in the middle of a short gap, at most 3 s after the first hit. */
  target: number;
}

/**
 * The gaps a refill can land in: between every two hits at least 2 s apart
 * (hits in the same second, or a second apart, leave no whole second between
 * them). Nothing after the last hit: that refill is sent by hand.
 */
export function refillWindows(hits: readonly number[]): RefillWindow[] {
  const sorted = [...new Set(hits)].sort((a, b) => a - b);
  const windows: RefillWindow[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const [after, before] = [sorted[i - 1], sorted[i]];
    const gap = Math.floor((before - after) / SECOND);
    if (gap >= 2) windows.push({ after, before, target: after + Math.min(Math.floor(gap / 2), MAX_REFILL_DELAY_SECONDS) * SECOND });
  }
  return windows;
}

/**
 * What the coordinator pastes into the game chat for players without the
 * page: every incoming hit with its leader in time order, and the refill
 * windows (they work out their own send time: window − their march).
 */
export function chatSummary(wave: readonly EnemyRally[]): { hits: Array<{ name: string; at: number }>; windows: number[] } {
  const hits = wave.map((r) => ({ name: r.name, at: rallyHit(r) })).sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  return { hits, windows: refillWindows(hits.map((h) => h.at)).map((w) => w.target) };
}

// ---------------------------------------------------------------------------
// A player's plan
// ---------------------------------------------------------------------------

export type SpeedupPercent = 25 | 50;

export interface Speedup {
  percent: SpeedupPercent;
  /** Use it when the march shows this many seconds left. */
  atLeft: number;
}

/**
 * The speedup that wins back `lateSeconds` (≥ 1). A march speedup cuts the time
 * left by its percentage (tested in the game: 2:00 left became 1:30 with 25%),
 * so 25% used at 4 × late seconds left saves exactly the delay, and 50% at
 * 2 × late. The cheaper 25% first; null when even 50% can't (the march is too short).
 */
export function speedupFor(lateSeconds: number, marchSeconds: number): Speedup | null {
  if (4 * lateSeconds <= marchSeconds) return { percent: 25, atLeft: 4 * lateSeconds };
  if (2 * lateSeconds <= marchSeconds) return { percent: 50, atLeft: 2 * lateSeconds };
  return null;
}

export type RefillStep =
  | { kind: "send"; number: number; window: RefillWindow; sendAt: number; lateSeconds: number; speedup: Speedup | null; speedupAt: number | null }
  | { kind: "skip"; number: number; window: RefillWindow };

/**
 * One player's refills, a send for every window: on time when it can be, else
 * at least `spacingSeconds` after their previous send (nobody sends two marches
 * a second apart) with the speedup that brings it back into its window. A
 * window even 50% can't reach after the previous send is skipped.
 */
export function planRefills(windows: readonly RefillWindow[], marchSeconds: number, spacingSeconds: number): RefillStep[] {
  let previous = Number.NEGATIVE_INFINITY;
  return windows.map((window, index) => {
    const number = index + 1;
    const onTime = window.target - marchSeconds * SECOND;
    const sendAt = Math.max(onTime, previous + spacingSeconds * SECOND);
    const lateSeconds = Math.round((sendAt - onTime) / SECOND);
    const speedup = lateSeconds === 0 ? null : speedupFor(lateSeconds, marchSeconds);
    if (lateSeconds > 0 && !speedup) return { kind: "skip", number, window };
    previous = sendAt;
    return { kind: "send", number, window, sendAt, lateSeconds, speedup, speedupAt: speedup ? sendAt + (marchSeconds - speedup.atLeft) * SECOND : null };
  });
}

export interface PlayerPlan {
  /** The incoming rallies while the wave is on, earliest hit first. */
  wave: EnemyRally[];
  windows: RefillWindow[];
  /** Empty until the player entered their march time. */
  steps: RefillStep[];
}

/** Everything a player's page shows, from the room's state and the player's own settings (march time, spacing). */
export function playerPlan(state: GarrisonState, now: number, marchSeconds: number | null, spacingSeconds: number): PlayerPlan {
  const wave = currentWave(state.rallies, now);
  const windows = refillWindows(wave.map(rallyHit));
  return { wave, windows, steps: marchSeconds === null ? [] : planRefills(windows, marchSeconds, spacingSeconds) };
}

/** Sending now, after the planned moment: seconds late, and the speedup that still lands it in its window (null: out of reach, or not late). */
export function sendNowAdvice(target: number, marchSeconds: number, now: number): { lateSeconds: number; speedup: Speedup | null } {
  const lateSeconds = Math.max(0, Math.floor((now - (target - marchSeconds * SECOND)) / SECOND));
  return { lateSeconds, speedup: lateSeconds === 0 ? null : speedupFor(lateSeconds, marchSeconds) };
}

export type RefillStage = "upcoming" | "send" | "speedup" | "boost" | "marching" | "done";

/** Where a send step stands: counting down to the send, the send second, counting down to the speedup, its second, on the way, landed. */
export function refillStage(step: Extract<RefillStep, { kind: "send" }>, now: number): RefillStage {
  const toSend = secondsUntil(step.sendAt, now);
  if (toSend > 0) return "upcoming";
  if (toSend === 0) return "send";
  if (step.speedupAt !== null) {
    const toBoost = secondsUntil(step.speedupAt, now);
    if (toBoost > 0) return "speedup";
    if (toBoost === 0) return "boost";
  }
  return now < step.window.target + SECOND ? "marching" : "done";
}

/**
 * Taps (sends and speedups) at most this far apart are one burst, shown big
 * together: a card that grew at the previous tap would leave too little time to
 * read it (the beeps for the next tap start 3 s before it).
 */
export const TOGETHER_SECONDS = 5;

/**
 * The steps a player's page shows big: the burst around their next tap. Bursts
 * come from the plan, not the moment, so no card changes size in the middle of
 * one: a card stays big after its send until the burst is over, then the next
 * burst takes over. Empty once every refill is on its way.
 */
export function focusSteps(steps: readonly RefillStep[], now: number): number[] {
  const taps = steps
    .flatMap((step, index) => (step.kind === "send" ? [step.sendAt, ...(step.speedupAt === null ? [] : [step.speedupAt])].map((at) => ({ at, index })) : []))
    .sort((a, b) => a.at - b.at || a.index - b.index);
  const next = taps.findIndex((tap) => secondsUntil(tap.at, now) >= 0); // still ahead, or this second
  if (next === -1) return [];
  const close = (i: number) => taps[i + 1].at - taps[i].at <= TOGETHER_SECONDS * SECOND;
  let [first, last] = [next, next];
  while (first > 0 && close(first - 1)) first--;
  while (last < taps.length - 1 && close(last)) last++;
  return [...new Set(taps.slice(first, last + 1).map((tap) => tap.index))].sort((a, b) => a - b);
}

/** A hit of this window moved in the last UPDATED_FLAG_SECONDS (the coordinator corrected a rally): the page says so. */
export function windowUpdated(window: RefillWindow, rallies: readonly EnemyRally[], now: number): boolean {
  return rallies.some((r) => {
    if (!r.movedAt) return false;
    const hit = rallyHit(r);
    return (hit === window.after || hit === window.before) && now - Date.parse(r.movedAt) < UPDATED_FLAG_SECONDS * SECOND;
  });
}

/**
 * The sounds of a player's plan: a chime 30 s before the first send, then for
 * every send and every speedup three rising beeps and the GO tone on its second.
 */
export function refillCues(steps: readonly RefillStep[]): SoundCue[] {
  const moments = steps.flatMap((s) => (s.kind === "send" ? [s.sendAt, ...(s.speedupAt === null ? [] : [s.speedupAt])] : []));
  if (moments.length === 0) return [];
  const cues: SoundCue[] = [{ at: Math.min(...moments) - 30 * SECOND, kind: "chime" }];
  for (const at of moments) {
    for (let left = 3; left >= 1; left--) cues.push({ at: at - left * SECOND, kind: "tick", step: 5 - left });
    cues.push({ at, kind: "go" });
  }
  return cues.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------------------
// The coordinator's changes (the server applies them; `now` is their game clock)
// ---------------------------------------------------------------------------

export type GarrisonProblem = "missing" | "launched" | "past" | "too_many" | "invalid";
export type GarrisonEdit = { ok: true; state: GarrisonState } | { ok: false; error: GarrisonProblem };

const iso = (ms: number) => new Date(ms).toISOString();
const done = (state: GarrisonState): GarrisonEdit => ({ ok: true, state });
const refuse = (error: GarrisonProblem): GarrisonEdit => ({ ok: false, error });

/** A leader without a name gets "#1", "#2" … (the first free number; no words, so it reads the same in every language). */
export function defaultEnemyName(enemies: readonly Pick<EnemyLeader, "name">[]): string {
  let n = 1;
  while (enemies.some((e) => e.name === `#${n}`)) n++;
  return `#${n}`;
}

/**
 * Adds a leader (`id` absent) or edits one. A new march time is remembered with
 * the old one (pets speed a leader up for two hours; "use 0:42 again" goes
 * back) and carried into their rally that hasn't launched yet.
 */
export function saveEnemy(state: GarrisonState, input: { id?: string; name: string; marchSeconds: number }, newId: string, now: number): GarrisonEdit {
  if (!isName(input.name) || !isMarch(input.marchSeconds)) return refuse("invalid");
  if (!input.id) {
    if (state.enemies.length >= MAX_ENEMIES) return refuse("too_many");
    const enemy: EnemyLeader = { id: newId, name: input.name, marchSeconds: input.marchSeconds, active: true, previousMarchSeconds: null, marchChangedAt: null };
    return done({ ...state, enemies: [...state.enemies, enemy] });
  }
  const existing = state.enemies.find((e) => e.id === input.id);
  if (!existing) return refuse("missing");
  const changed = existing.marchSeconds !== input.marchSeconds;
  const enemies = state.enemies.map((e) =>
    e.id === existing.id
      ? { ...e, name: input.name, marchSeconds: input.marchSeconds, ...(changed ? { previousMarchSeconds: existing.marchSeconds, marchChangedAt: iso(now) } : {}) }
      : e,
  );
  const rallies = state.rallies.map((r) =>
    r.enemyId === existing.id && !hasLaunched(r, now) ? { ...r, name: input.name, marchSeconds: input.marchSeconds, ...(changed ? { movedAt: iso(now) } : {}) } : r,
  );
  return done({ enemies, rallies });
}

export function setEnemyActive(state: GarrisonState, enemyId: string, active: boolean): GarrisonEdit {
  if (!state.enemies.some((e) => e.id === enemyId)) return refuse("missing");
  return done({ ...state, enemies: state.enemies.map((e) => (e.id === enemyId ? { ...e, active } : e)) });
}

/** Removes a leader from the list; a rally of theirs already marked stays (it is coming either way). */
export function removeEnemy(state: GarrisonState, enemyId: string): GarrisonEdit {
  return done({ ...state, enemies: state.enemies.filter((e) => e.id !== enemyId) });
}

/**
 * The coordinator tapped a countdown button for `enemyId`: their rally that
 * hasn't launched yet gets the new launch (a wrong button is fixed by tapping
 * the right one), else a new rally joins the wave. A finished wave is dropped first.
 */
export function markRally(state: GarrisonState, enemyId: string, launchAt: number, now: number, newId: string): GarrisonEdit {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return refuse("missing");
  if (launchAt <= now) return refuse("past");
  const wave = currentWave(state.rallies, now);
  const pending = wave.find((r) => r.enemyId === enemyId && !hasLaunched(r, now));
  if (pending) {
    const moved = { ...pending, name: enemy.name, marchSeconds: enemy.marchSeconds, launchAt: iso(launchAt), movedAt: iso(now) };
    return done({ ...state, rallies: wave.map((r) => (r.id === pending.id ? moved : r)) });
  }
  if (wave.length >= MAX_ENEMY_RALLIES) return refuse("too_many");
  const rally: EnemyRally = { id: newId, enemyId, name: enemy.name, marchSeconds: enemy.marchSeconds, launchAt: iso(launchAt), movedAt: null };
  return done({ ...state, rallies: [...wave, rally] });
}

/** ±n seconds on a rally's launch, only until it launches (after that its time is fixed unless a landing is observed). */
export function nudgeRally(state: GarrisonState, rallyId: string, deltaSeconds: number, now: number): GarrisonEdit {
  if (!Number.isInteger(deltaSeconds) || deltaSeconds === 0 || Math.abs(deltaSeconds) > MAX_NUDGE_SECONDS) return refuse("invalid");
  const rally = currentWave(state.rallies, now).find((r) => r.id === rallyId);
  if (!rally) return refuse("missing");
  if (hasLaunched(rally, now)) return refuse("launched");
  const launchAt = Date.parse(rally.launchAt) + deltaSeconds * SECOND;
  if (launchAt <= now) return refuse("past");
  return done({ ...state, rallies: state.rallies.map((r) => (r.id === rally.id ? { ...r, launchAt: iso(launchAt), movedAt: iso(now) } : r)) });
}

/**
 * "Lands in": the coordinator read the incoming march's time left. For the
 * leader's rally that is marching, that is a measurement: it fixes the hit and
 * becomes the leader's march time for the next waves (a new leader whose march
 * was a guess, or pets). Without a marching rally (missed during its countdown)
 * the launch is worked back from the leader's march time.
 */
export function rallyLands(state: GarrisonState, enemyId: string, hitAt: number, now: number, newId: string): GarrisonEdit {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy) return refuse("missing");
  if (hitAt <= now) return refuse("past");
  const wave = currentWave(state.rallies, now);
  const marching = wave
    .filter((r) => r.enemyId === enemyId && hasLaunched(r, now) && rallyHit(r) > now - LANDED_SLACK_MS)
    .sort((a, b) => Date.parse(b.launchAt) - Date.parse(a.launchAt))[0];
  if (marching) {
    const march = Math.round((hitAt - Date.parse(marching.launchAt)) / SECOND);
    if (!isMarch(march)) return refuse("invalid");
    const enemies = state.enemies.map((e) =>
      e.id === enemyId && e.marchSeconds !== march ? { ...e, marchSeconds: march, previousMarchSeconds: e.marchSeconds, marchChangedAt: iso(now) } : e,
    );
    return done({ enemies, rallies: wave.map((r) => (r.id === marching.id ? { ...r, marchSeconds: march, movedAt: iso(now) } : r)) });
  }
  const launchAt = hitAt - enemy.marchSeconds * SECOND;
  const pending = wave.find((r) => r.enemyId === enemyId && !hasLaunched(r, now));
  if (pending) return done({ ...state, rallies: wave.map((r) => (r.id === pending.id ? { ...r, launchAt: iso(launchAt), movedAt: iso(now) } : r)) });
  if (wave.length >= MAX_ENEMY_RALLIES) return refuse("too_many");
  const rally: EnemyRally = { id: newId, enemyId, name: enemy.name, marchSeconds: enemy.marchSeconds, launchAt: iso(launchAt), movedAt: null };
  return done({ ...state, rallies: [...wave, rally] });
}

export function removeRally(state: GarrisonState, rallyId: string): GarrisonEdit {
  return done({ ...state, rallies: state.rallies.filter((r) => r.id !== rallyId) });
}

export function clearRallies(state: GarrisonState): GarrisonEdit {
  return done({ ...state, rallies: [] });
}
