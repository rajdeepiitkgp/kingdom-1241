// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { localeField } from "@/lib/admin/forms";
import { localePath } from "@/lib/i18n/paths";
import { getPasswordRules } from "@/lib/config/settings";
import { passwordPolicies } from "@/lib/kvk/password-rules";
import { retryAfter, triesLeft } from "@/lib/kvk/throttle";
import { addressHash, clearThrottle, loadThrottle, takeTry } from "@/lib/kvk/throttle-store";
import { createLogger, requestId, type Logger } from "@/lib/log";
import {
  hashPassword,
  hashToken,
  instanceCookieValue,
  inviteKey,
  isValidInviteKey,
  newInstanceTag,
  newToken,
  roomAccessToken,
  roomCookieName,
  roomCookieOptions,
  tokenMatches,
  verifyPassword,
} from "./access";
import {
  clearRallies,
  defaultEnemyName,
  type GarrisonEdit,
  type GarrisonState,
  launchFromTap,
  markRally,
  nudgeRally,
  rallyLands,
  removeEnemy,
  removeRally,
  saveEnemy,
  secondsInRange,
  setEnemyActive,
  tapMoment,
} from "./garrison";
import {
  canSwitchMode,
  joinStatus,
  type InstanceView,
  leaderEdit,
  normalizeRoomCode,
  parseInstanceName,
  parseMarch,
  parseName,
  parsePassword,
  parseSettings,
  pushHistory,
  rallyRunning,
  resyncMarches,
  type RoomMode,
  sortInstances,
  statusAfter,
} from "./room";
import { findOpenRoom, roomAccess, roomCapacity } from "./session";
import { type InstanceRow, type LeaderRow, type RallyStore, rallyStore, RallyStoreError, type RoomPatch, type RoomRow } from "./store";
import { clampGameOffset, earliestHit, MAX_MARCH_SECONDS, MAX_RALLY_WAIT_SECONDS, parseUtcClock, toGameTime } from "./timing";

/**
 * Server Actions of a Rally Sync room. Like every Server Function they can be
 * POSTed directly, so each one opens the room again, checks the visitor's
 * room cookie and, where it matters, the leader's or coordinator's token
 * (the browser keeps them; the database only has hashes). Rooms themselves are
 * created by moderators (src/lib/admin/rally-sync-actions.ts). Logs carry the
 * room code and what happened, never a name, password or token.
 */

export type SyncError =
  | "invalid"
  | "wrong"
  | "throttled"
  | "missing"
  | "closed"
  | "unavailable"
  | "locked"
  | "not_coordinator"
  | "not_yours"
  | "past"
  | "room_limit"
  | "leader_limit"
  | "instance_limit"
  /** Garrison: the rally has launched, so only a measured landing may change it. */
  | "launched"
  /** Garrison: the list of enemy leaders or incoming rallies is full. */
  | "too_many"
  | "failed";

export type SyncResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: SyncError; retryAt?: number };

export interface UnlockRoomState {
  status: "idle" | "error";
  error?: SyncError;
  /** `throttled`: when (ms since epoch) this address may try again. */
  retryAt?: number;
  /** `wrong`: tries left before this address is locked out. */
  triesLeft?: number;
}

export interface LeaderInput {
  name: string;
  marchSeconds: number;
}

export type CoordinatorOp =
  | { type: "settings"; mode: RoomMode; rallyWaitSeconds: number; bufferSeconds: number; counterOffsetSeconds: number }
  | { type: "hitClock"; text: string }
  | { type: "resync" }
  | { type: "clearHit" }
  | { type: "addLeader"; name: string; marchSeconds: number }
  | { type: "editLeader"; leaderId: string; name: string; marchSeconds: number }
  | { type: "removeLeader"; leaderId: string }
  | { type: "setActive"; leaderId: string; active: boolean }
  | { type: "password"; password: string }
  | { type: "removeInstance"; instanceId: string }
  | { type: "removeOthers" }
  /** The current invite key; with `password`, also whether that (a device's saved copy) is still the room's password. */
  | { type: "invite"; password?: string }
  | { type: "destroy" }
  | GarrisonOp;

/**
 * Garrison rooms (garrison.ts): the list of enemy rally leaders, and marking their rallies. `tappedAt` is
 * the moment of the tap on the coordinator's game clock (their page's corrected clock), so the request's
 * travel time doesn't move the launch.
 */
export type GarrisonOp =
  /** Adds a leader (no `enemyId`; an empty name becomes "#1", "#2" …) or edits one. */
  | { type: "enemySave"; enemyId?: string; name: string; marchSeconds: number }
  | { type: "enemyActive"; enemyId: string; active: boolean }
  | { type: "enemyRemove"; enemyId: string }
  /** A countdown button: the enemy's rally launches `countdownSeconds` after the tap. */
  | { type: "rallyMark"; enemyId: string; countdownSeconds: number; tappedAt: number }
  /** The incoming march showed `landsInSeconds` at the tap (corrects a marching rally's march time). */
  | { type: "rallyLands"; enemyId: string; landsInSeconds: number; tappedAt: number }
  | { type: "rallyNudge"; rallyId: string; deltaSeconds: number }
  | { type: "rallyRemove"; rallyId: string }
  | { type: "ralliesClear" };

/** Tries of a garrison write against concurrent writes (the room's heartbeat also counts as one). */
const GARRISON_WRITE_ROUNDS = 5;

const GARRISON_OPS: ReadonlySet<string> = new Set(["enemySave", "enemyActive", "enemyRemove", "rallyMark", "rallyLands", "rallyNudge", "rallyRemove", "ralliesClear"]);
/** Only rally rooms have a hit time: counter rooms give a launch order (counter.ts), garrison rooms mark enemy rallies. */
const HIT_OPS: ReadonlySet<string> = new Set(["hitClock", "resync", "clearHit"]);

const baseLog = createLogger("rally-sync");

async function context(): Promise<{ log: Logger; address: string }> {
  const requestHeaders = await headers();
  return { log: baseLog.child({ reqId: requestId(requestHeaders) }), address: addressHash(requestHeaders) };
}

/**
 * Throttle scopes of one address: wrong passwords (and invite keys) count per
 * room, so opening one room never resets the count of another; codes that
 * match no open room count on their own.
 */
const roomScope = (roomId: string, address: string) => `sync:ip:${roomId}:${address}`;
const codeScope = (address: string) => `sync:code:${address}`;

// ---------------------------------------------------------------------------
// Unlocking (password form, invite link)
// ---------------------------------------------------------------------------

/** Room code + password (the Join form and the room's lock). Wrong codes are counted too, and lock the address like wrong passwords. */
export async function unlockRoom(_previous: UnlockRoomState, formData: FormData): Promise<UnlockRoomState> {
  const { log, address } = await context();
  const code = normalizeRoomCode(formData.get("code"));
  const password = String(formData.get("password") ?? "");
  const locale = localeField(formData);
  if (!code || !password.trim()) return { status: "error", error: "invalid" };

  // The in-memory store (local review) has no throttle table to write to.
  const throttling = rallyStore()?.kind === "supabase";
  const [found, [codeState]] = await Promise.all([findOpenRoom(code), throttling ? loadThrottle([codeScope(address)]) : Promise.resolve([null])]);
  const now = Date.now();
  const codeWait = retryAfter(codeState, now);
  if (codeWait > 0) return { status: "error", error: "throttled", retryAt: now + codeWait };

  if ("problem" in found && (found.problem === "unavailable" || found.problem === "closed")) return { status: "error", error: found.problem };
  const opened = "room" in found ? found : null;
  // Every try is counted before anything is checked, so parallel requests can't outrun the lockout.
  const scope = opened ? roomScope(opened.room.id, address) : codeScope(address);
  const policy = passwordPolicies(await getPasswordRules()).address;
  const attempt = throttling ? await takeTry(scope, now, policy) : ({ allowed: true, state: null } as const);
  if (!attempt.allowed) return { status: "error", error: "throttled", retryAt: attempt.retryAt };

  if (!opened || !(await verifyPassword(password, opened.room.passwordHash))) {
    log.info("Room unlock failed", { room: code, reason: opened ? "password" : "code", failures: attempt.state?.failures });
    const lock = retryAfter(attempt.state, now);
    if (lock > 0) return { status: "error", error: "throttled", retryAt: now + lock };
    return { status: "error", error: "wrong", triesLeft: triesLeft(attempt.state, now, policy) };
  }

  const { store, room } = opened;
  const problem = await enterRoom(store, room, log);
  if (problem) return { status: "error", error: problem };
  if (attempt.state) await clearThrottle(scope);
  log.info("Room unlocked", { room: room.code, via: "password" });
  redirect(localePath(locale, `/tools/rally-sync/${room.code}`));
}

/** The key from an invite link (`#k=…`): sets the room cookie like a correct password. */
export async function unlockRoomWithKey(code: string, key: string): Promise<SyncResult> {
  const { log, address } = await context();
  const found = await findOpenRoom(code);
  if ("problem" in found) return { ok: false, error: found.problem };
  const { store, room } = found;
  const scope = roomScope(room.id, address);
  const now = Date.now();
  const attempt = store.kind === "supabase" ? await takeTry(scope, now, passwordPolicies(await getPasswordRules()).address) : ({ allowed: true, state: null } as const);
  if (!attempt.allowed) return { ok: false, error: "throttled", retryAt: attempt.retryAt };

  if (!isValidInviteKey(typeof key === "string" ? key : "", room.id, room.passwordHash)) {
    log.info("Room unlock failed", { room: room.code, reason: "invite key", failures: attempt.state?.failures });
    return { ok: false, error: "wrong" };
  }
  const problem = await enterRoom(store, room, log);
  if (problem) return { ok: false, error: problem };
  if (attempt.state) await clearThrottle(scope);
  log.info("Room unlocked", { room: room.code, via: "invite link" });
  return { ok: true };
}

/**
 * Makes this browser an instance of the room and sets the room cookie naming it
 * (a browser that is already in keeps its instance). While a deploy runs ahead of
 * migration 0014 there is no instance table yet: the old password-bound cookie then.
 */
async function enterRoom(store: RallyStore, room: RoomRow, log: Logger): Promise<SyncError | null> {
  const current = await roomAccess(store, room).catch(() => null);
  if (current?.instance) return null;
  let value: string;
  try {
    const instance = await store.insertInstance({ roomId: room.id, tag: newInstanceTag() });
    value = instanceCookieValue(room.id, instance.id);
  } catch (error) {
    if (!(error instanceof RallyStoreError && error.problem === "not_migrated")) return storeError(error, log, "Entering a room").error;
    value = roomAccessToken(room.id, room.passwordHash);
  }
  (await cookies()).set({ name: roomCookieName(room.code), value, ...roomCookieOptions() });
  return null;
}

// ---------------------------------------------------------------------------
// Leaders (their own row, with the token their device keeps)
// ---------------------------------------------------------------------------

type Opened = { store: RallyStore; room: RoomRow; instance: InstanceRow | null };

/** The room, if it is open and this visitor's cookie still opens it (their instance, if any). */
async function openUnlocked(code: string): Promise<Opened | { error: SyncError }> {
  const found = await findOpenRoom(code);
  if ("problem" in found) return { error: found.problem };
  try {
    const access = await roomAccess(found.store, found.room);
    if (!access) return { error: "locked" };
    return { ...found, instance: access.instance };
  } catch {
    return { error: "unavailable" };
  }
}

function storeError(error: unknown, log: Logger, what: string): { ok: false; error: SyncError } {
  if (error instanceof RallyStoreError) {
    const problem = error.problem;
    if (problem === "room_limit" || problem === "leader_limit" || problem === "instance_limit") return { ok: false, error: problem };
    if (problem === "room_closed") return { ok: false, error: "closed" };
  }
  log.error(`${what} failed`, { error: error instanceof Error ? error.message : String(error) });
  return { ok: false, error: "failed" };
}

/** No room for another leader (the owner's limit for this type of room; the database checks again). */
async function roomFull(store: RallyStore, room: RoomRow): Promise<boolean> {
  const [leaders, capacity] = await Promise.all([store.leaders(room.id), roomCapacity(store)]);
  return leaders.length >= capacity[room.mode].leaders;
}

function parseLeader(input: LeaderInput): LeaderInput | null {
  const name = parseName(input?.name);
  const march = parseMarch(input?.marchSeconds);
  return name.ok && march.ok ? { name: name.value, marchSeconds: march.value } : null;
}

/** A leader's entry saved by the leader or the coordinator (the rules are in leaderEdit); `now` is on the game clock. */
function editPatch(room: RoomRow, leader: LeaderRow, input: LeaderInput, now: number, byCoordinator: boolean) {
  // `at` is on the game clock like the room's hitSetAt, which startChanged compares it with.
  return leaderEdit(leader, input, { running: rallyRunning(room.hitAt, now), byCoordinator, at: new Date(now).toISOString() });
}

/** Joining as a rally leader. During a running rally (on the joiner's game clock) they are in from the next one. */
export async function joinRoom(code: string, input: LeaderInput, gameOffsetSeconds = 0): Promise<SyncResult<{ leaderId: string; token: string }>> {
  const { log } = await context();
  const opened = await openUnlocked(code);
  if ("error" in opened) return { ok: false, error: opened.error };
  const leader = parseLeader(input);
  if (!leader) return { ok: false, error: "invalid" };
  const { store, room } = opened;
  try {
    if (await roomFull(store, room)) return { ok: false, error: "leader_limit" };
    const token = newToken();
    const running = rallyRunning(room.hitAt, toGameTime(Date.now(), clampGameOffset(gameOffsetSeconds)));
    const row = await store.insertLeader({
      roomId: room.id,
      name: leader.name,
      marchSeconds: leader.marchSeconds,
      status: joinStatus(running),
      tokenHash: hashToken(token),
      instanceId: opened.instance?.id ?? null,
    });
    // From now on the coordinator sees this browser by its leader's name; a name it had as a watcher goes.
    if (opened.instance?.name) await store.updateInstance(opened.instance.id, { name: null });
    log.info("Leader joined", { room: room.code, leader: row.id });
    return { ok: true, leaderId: row.id, token };
  } catch (error) {
    return storeError(error, log, "Joining a room");
  }
}

async function ownLeader(code: string, leaderId: string, token: string): Promise<(Opened & { leader: LeaderRow }) | { error: SyncError }> {
  const opened = await openUnlocked(code);
  if ("error" in opened) return opened;
  const leader = (await opened.store.leaders(opened.room.id)).find((l) => l.id === leaderId);
  if (!leader || !tokenMatches(token, leader.tokenHash)) return { error: "not_yours" };
  return { ...opened, leader };
}

/**
 * The leader's own entry. `gameOffsetSeconds` is their game-clock adjustment:
 * whether a rally is still running (and a new march time waits for the next
 * one) is decided on their game clock, like the countdown they see.
 */
export async function updateMyLeader(code: string, leaderId: string, token: string, input: LeaderInput, gameOffsetSeconds = 0): Promise<SyncResult> {
  const { log } = await context();
  try {
    const own = await ownLeader(code, leaderId, token);
    if ("error" in own) return { ok: false, error: own.error };
    const leader = parseLeader(input);
    if (!leader) return { ok: false, error: "invalid" };
    const now = toGameTime(Date.now(), clampGameOffset(gameOffsetSeconds));
    await own.store.updateLeader(own.leader.id, editPatch(own.room, own.leader, leader, now, false));
    log.info("Leader updated their entry", { room: own.room.code, leader: own.leader.id });
    return { ok: true };
  } catch (error) {
    return storeError(error, log, "Updating a leader");
  }
}

/** Sitting out or coming back (see statusAfter); "now" on the leader's game clock. */
export async function setMyActive(code: string, leaderId: string, token: string, active: boolean, gameOffsetSeconds = 0): Promise<SyncResult> {
  const { log } = await context();
  try {
    const own = await ownLeader(code, leaderId, token);
    if ("error" in own) return { ok: false, error: own.error };
    const running = rallyRunning(own.room.hitAt, toGameTime(Date.now(), clampGameOffset(gameOffsetSeconds)));
    const status = statusAfter(own.leader.status, active === true, running);
    if (status !== own.leader.status) await own.store.updateLeader(own.leader.id, { status });
    log.info("Leader set their status", { room: own.room.code, leader: own.leader.id, status });
    return { ok: true };
  } catch (error) {
    return storeError(error, log, "Setting a leader's status");
  }
}

export async function leaveRoom(code: string, leaderId: string, token: string): Promise<SyncResult> {
  const { log } = await context();
  try {
    const own = await ownLeader(code, leaderId, token);
    if ("error" in own) return { ok: false, error: own.error };
    await own.store.deleteLeader(own.leader.id);
    // Back to watching: the browser keeps the leader's name, so the coordinator still knows who it is.
    if (own.instance && !own.instance.name && own.leader.instanceId === own.instance.id) await own.store.updateInstance(own.instance.id, { name: own.leader.name });
    log.info("Leader left", { room: own.room.code, leader: own.leader.id });
    return { ok: true };
  } catch (error) {
    return storeError(error, log, "Leaving a room");
  }
}

// ---------------------------------------------------------------------------
// Coordinator (one token per room, from the creator or the coordinator link)
// ---------------------------------------------------------------------------

/**
 * The new hit time, with the old one moved into the history. All of these are
 * game-clock times (see timing.ts): `now` is the coordinator's game "now".
 */
function hitPatch(room: RoomRow, hitAt: number | null, now: number): RoomPatch {
  const previous = room.hitAt ? { hitAt: room.hitAt, setAt: room.hitSetAt ?? room.hitAt } : null;
  return {
    hitAt: hitAt === null ? null : new Date(hitAt).toISOString(),
    hitSetAt: hitAt === null ? null : new Date(now).toISOString(),
    // Only the counter-rally mode before 27 Oct 2026 set this; the column stays until a later migration drops it.
    enemyHitAt: null,
    history: pushHistory(room.history, previous),
  };
}

/**
 * A new hit time (or none) starts the next rally: march times that waited for
 * it become the leaders' march times, and leaders who joined or came back
 * during the last one are in. Those sitting out stay out. Called before the
 * room is updated, so pages that refetch on the room's ping see both together.
 */
async function startNextRally(store: RallyStore, leaders: readonly LeaderRow[]): Promise<void> {
  await Promise.all(
    leaders
      .filter((l) => l.nextMarchSeconds !== null || l.status === "next")
      .map((l) =>
        store.updateLeader(l.id, {
          ...(l.nextMarchSeconds !== null ? { marchSeconds: l.nextMarchSeconds, nextMarchSeconds: null } : {}),
          ...(l.status === "next" ? { status: "active" as const } : {}),
        }),
      ),
  );
}

/** An instance that used coordinator rights is marked as such in the coordinator's list (once). */
async function markCoordinator(store: RallyStore, instance: InstanceRow | null): Promise<void> {
  if (instance && !instance.coordinator) await store.updateInstance(instance.id, { coordinator: true }).catch(() => undefined);
}

/**
 * Every browser in the room, for the coordinator: who it is (own name, else its
 * leaders, else its tag), whether it coordinates, when it was last on screen.
 */
export async function listInstances(code: string, token: string): Promise<SyncResult<{ instances: InstanceView[] }>> {
  const { log } = await context();
  if (typeof token !== "string") return { ok: false, error: "invalid" };
  const opened = await openUnlocked(code);
  if ("error" in opened) return { ok: false, error: opened.error };
  const { store, room, instance } = opened;
  if (!tokenMatches(token, room.coordinatorHash)) return { ok: false, error: "not_coordinator" };
  try {
    await markCoordinator(store, instance);
    const [rows, leaders] = await Promise.all([store.instances(room.id), store.leaders(room.id)]);
    const instances = rows.map((row) => ({
      id: row.id,
      tag: row.tag,
      name: row.name,
      leaders: leaders.filter((l) => l.instanceId === row.id).map((l) => l.name),
      coordinator: row.coordinator || row.id === instance?.id,
      me: row.id === instance?.id,
      lastSeenAt: row.lastSeenAt,
    }));
    return { ok: true, instances: sortInstances(instances) };
  } catch (error) {
    // Before migration 0014 there is nobody to list yet.
    if (error instanceof RallyStoreError && error.problem === "not_migrated") return { ok: true, instances: [] };
    return storeError(error, log, "Listing instances");
  }
}

/** The visitor names their own browser in the room (or clears the name to go back to their tag). Only the coordinator sees it. */
export async function renameMe(code: string, name: unknown): Promise<SyncResult> {
  const { log } = await context();
  const parsed = parseInstanceName(name);
  if (!parsed.ok) return { ok: false, error: "invalid" };
  const opened = await openUnlocked(code);
  if ("error" in opened) return { ok: false, error: opened.error };
  if (!opened.instance) return { ok: false, error: "unavailable" };
  try {
    await opened.store.updateInstance(opened.instance.id, { name: parsed.value });
    log.info("Instance named", { room: opened.room.code, named: parsed.value !== null });
    return { ok: true };
  } catch (error) {
    return storeError(error, log, "Naming an instance");
  }
}

/**
 * One coordinator change. `gameOffsetSeconds` is the coordinator's game-clock
 * adjustment: typed times are game times as they are, while Re-sync and the
 * "already passed" check count from the coordinator's game "now".
 */
export async function coordinate(
  code: string,
  token: string,
  op: CoordinatorOp,
  gameOffsetSeconds = 0,
): Promise<SyncResult<{ inviteKey?: string; passwordCurrent?: boolean; enemyId?: string }>> {
  const { log } = await context();
  // A direct POST can send anything; the checks below expect a token string and an op object.
  if (typeof token !== "string" || typeof op !== "object" || op === null || typeof op.type !== "string") return { ok: false, error: "invalid" };
  const opened = await openUnlocked(code);
  if ("error" in opened) return { ok: false, error: opened.error };
  const { store, room, instance } = opened;
  if (!tokenMatches(token, room.coordinatorHash)) return { ok: false, error: "not_coordinator" };
  if (HIT_OPS.has(op.type) && room.mode !== "rally") return { ok: false, error: "invalid" };
  await markCoordinator(store, instance);
  // The game clock is the reference: "now" is the coordinator's game clock (server time + their adjustment).
  const now = toGameTime(Date.now(), clampGameOffset(gameOffsetSeconds));
  const done = (fields: Record<string, unknown> = {}) => {
    log.info("Coordinator action", { room: room.code, action: op.type, ...fields });
    return { ok: true as const };
  };

  try {
    switch (op.type) {
      case "settings": {
        const settings = parseSettings(op);
        if (!settings.ok || !canSwitchMode(room.mode, settings.value.mode)) return { ok: false, error: "invalid" };
        await store.updateRoom(room.id, settings.value);
        return done();
      }
      case "hitClock": {
        const hitAt = parseUtcClock(String(op.text ?? ""), now);
        if (hitAt === null) return { ok: false, error: "invalid" };
        if (hitAt <= now) return { ok: false, error: "past" };
        await startNextRally(store, await store.leaders(room.id));
        await store.updateRoom(room.id, hitPatch(room, hitAt, now));
        return done();
      }
      case "resync": {
        const leaders = await store.leaders(room.id);
        const marches = resyncMarches(leaders);
        await startNextRally(store, leaders);
        await store.updateRoom(room.id, hitPatch(room, earliestHit(now, room.rallyWaitSeconds, marches, room.bufferSeconds), now));
        return done({ leaders: marches.length });
      }
      case "clearHit": {
        await startNextRally(store, await store.leaders(room.id));
        await store.updateRoom(room.id, hitPatch(room, null, now));
        return done();
      }
      case "addLeader": {
        const leader = parseLeader(op);
        if (!leader) return { ok: false, error: "invalid" };
        if (await roomFull(store, room)) return { ok: false, error: "leader_limit" };
        const row = await store.insertLeader({ roomId: room.id, name: leader.name, marchSeconds: leader.marchSeconds, tokenHash: null });
        return done({ leader: row.id });
      }
      case "editLeader": {
        const leader = parseLeader(op);
        if (!leader) return { ok: false, error: "invalid" };
        const existing = (await store.leaders(room.id)).find((l) => l.id === op.leaderId);
        if (!existing) return { ok: false, error: "missing" };
        await store.updateLeader(existing.id, editPatch(room, existing, leader, now, true));
        return done({ leader: existing.id });
      }
      case "setActive": {
        const existing = (await store.leaders(room.id)).find((l) => l.id === op.leaderId);
        if (!existing) return { ok: false, error: "missing" };
        const status = statusAfter(existing.status, op.active === true, rallyRunning(room.hitAt, now));
        if (status !== existing.status) await store.updateLeader(existing.id, { status });
        return done({ leader: existing.id, status });
      }
      case "removeLeader": {
        const existing = (await store.leaders(room.id)).find((l) => l.id === op.leaderId);
        if (existing) await store.deleteLeader(existing.id);
        return done({ leader: op.leaderId });
      }
      case "password": {
        const password = parsePassword(op.password);
        if (!password.ok) return { ok: false, error: "invalid" };
        const passwordHash = await hashPassword(password.value);
        await store.updateRoom(room.id, { passwordHash });
        // Everyone who is in stays in (cookies name instances, not the password); newcomers and old
        // invite links need the new one. A coordinator on a pre-instance cookie gets a fresh one.
        if (!instance) (await cookies()).set({ name: roomCookieName(room.code), value: roomAccessToken(room.id, passwordHash), ...roomCookieOptions() });
        done();
        return { ok: true, inviteKey: inviteKey(room.id, passwordHash) };
      }
      case "removeInstance": {
        // Never the coordinator's own browser: that would lock them out of their own room.
        if (typeof op.instanceId !== "string" || op.instanceId === instance?.id) return { ok: false, error: "invalid" };
        const removed = await store.deleteInstances(room.id, { ids: [op.instanceId] });
        return done({ removed });
      }
      case "removeOthers": {
        const removed = await store.deleteInstances(room.id, { except: instance?.id ?? null });
        return done({ removed });
      }
      case "invite": {
        // Another coordinator may have changed the password since this device saved its copy and link.
        const saved = typeof op.password === "string" && op.password ? op.password : null;
        const passwordCurrent = saved === null ? undefined : await verifyPassword(saved, room.passwordHash);
        return { ok: true, inviteKey: inviteKey(room.id, room.passwordHash), passwordCurrent };
      }
      case "destroy": {
        await store.deleteRoom(room.id);
        (await cookies()).delete(roomCookieName(room.code));
        return done();
      }
      default: {
        if (!GARRISON_OPS.has(op.type) || room.mode !== "garrison") return { ok: false, error: "invalid" };
        // Two coordinators may tap in the same moment: each write applies to the room as it is (compare-and-swap, re-read on a clash).
        const garrisonOp = op as GarrisonOp;
        const newId = randomUUID();
        let current: RoomRow | null = room;
        for (let round = 0; current && round < GARRISON_WRITE_ROUNDS; round++) {
          const edit = garrisonEdit(current.garrison, garrisonOp, now, newId);
          if (!edit.ok) return { ok: false, error: edit.error };
          if (await store.updateRoomIf(current.id, current.updatedAt, { garrison: edit.state })) {
            done({ rallies: edit.state.rallies.length, round });
            // A new leader: the panel selects them at once (the coordinator is about to mark their rally).
            return garrisonOp.type === "enemySave" && !garrisonOp.enemyId ? { ok: true, enemyId: newId } : { ok: true };
          }
          current = await store.roomById(current.id);
        }
        if (!current) return { ok: false, error: "closed" };
        log.warn("Garrison write kept clashing", { room: room.code, action: op.type });
        return { ok: false, error: "failed" };
      }
    }
  } catch (error) {
    return storeError(error, log, `Coordinator action ${op.type}`);
  }
}

/** One garrison change on the stored state (the rules are in garrison.ts); `now` is the coordinator's game clock. */
function garrisonEdit(state: GarrisonState, op: GarrisonOp, now: number, newId: string): GarrisonEdit {
  const invalid: GarrisonEdit = { ok: false, error: "invalid" };
  const id = (value: unknown) => (typeof value === "string" ? value : "");
  switch (op.type) {
    case "enemySave": {
      const typed = typeof op.name === "string" ? op.name.trim() : "";
      const editing = typeof op.enemyId === "string" && op.enemyId !== "";
      const name = typed ? parseName(typed) : editing ? ({ ok: false } as const) : ({ ok: true, value: defaultEnemyName(state.enemies) } as const);
      const march = parseMarch(op.marchSeconds);
      if (!name.ok || !march.ok) return invalid;
      return saveEnemy(state, { id: editing ? op.enemyId : undefined, name: name.value, marchSeconds: march.value }, newId, now);
    }
    case "enemyActive":
      return setEnemyActive(state, id(op.enemyId), op.active === true);
    case "enemyRemove":
      return removeEnemy(state, id(op.enemyId));
    case "rallyMark": {
      const countdown = secondsInRange(op.countdownSeconds, 1, MAX_RALLY_WAIT_SECONDS);
      if (countdown === null) return invalid;
      return markRally(state, id(op.enemyId), launchFromTap(tapMoment(op.tappedAt, now), countdown), now, newId);
    }
    case "rallyLands": {
      const landsIn = secondsInRange(op.landsInSeconds, 1, MAX_MARCH_SECONDS);
      if (landsIn === null) return invalid;
      return rallyLands(state, id(op.enemyId), launchFromTap(tapMoment(op.tappedAt, now), landsIn), now, newId);
    }
    case "rallyNudge":
      return nudgeRally(state, id(op.rallyId), Number(op.deltaSeconds), now);
    case "rallyRemove":
      return removeRally(state, id(op.rallyId));
    case "ralliesClear":
      return clearRallies(state);
  }
}
