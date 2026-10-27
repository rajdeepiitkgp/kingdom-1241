// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { localeField } from "@/lib/admin/forms";
import { localePath } from "@/lib/i18n/paths";
import { ADDRESS_POLICY, retryAfter, triesLeft } from "@/lib/kvk/throttle";
import { addressHash, clearThrottle, loadThrottle, takeTry } from "@/lib/kvk/throttle-store";
import { createLogger, requestId, type Logger } from "@/lib/log";
import { hashPassword, hashToken, inviteKey, isValidInviteKey, newToken, roomAccessToken, roomCookieName, roomCookieOptions, tokenMatches, verifyPassword } from "./access";
import {
  joinStatus,
  leaderEdit,
  MAX_LEADERS_PER_ROOM,
  normalizeRoomCode,
  parseMarch,
  parseName,
  parsePassword,
  parseSettings,
  pushHistory,
  rallyRunning,
  resyncMarches,
  type RoomMode,
  statusAfter,
} from "./room";
import { findOpenRoom, hasRoomAccess } from "./session";
import { type LeaderRow, type RallyStore, rallyStore, RallyStoreError, type RoomPatch, type RoomRow } from "./store";
import { ceilToSecond, clampGameOffset, counterHit, earliestHit, parseDuration, parseUtcClock, toGameTime } from "./timing";

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
  | "total_limit"
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
  | { type: "enemyClock"; text: string }
  | { type: "enemyIn"; text: string }
  | { type: "clearHit" }
  | { type: "addLeader"; name: string; marchSeconds: number }
  | { type: "editLeader"; leaderId: string; name: string; marchSeconds: number }
  | { type: "removeLeader"; leaderId: string }
  | { type: "setActive"; leaderId: string; active: boolean }
  | { type: "password"; password: string }
  | { type: "invite" }
  | { type: "destroy" };

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
  const room = "room" in found ? found.room : null;
  // Every try is counted before anything is checked, so parallel requests can't outrun the lockout.
  const scope = room ? roomScope(room.id, address) : codeScope(address);
  const attempt = throttling ? await takeTry(scope, now, ADDRESS_POLICY) : ({ allowed: true, state: null } as const);
  if (!attempt.allowed) return { status: "error", error: "throttled", retryAt: attempt.retryAt };

  if (!room || !(await verifyPassword(password, room.passwordHash))) {
    log.info("Room unlock failed", { room: code, reason: room ? "password" : "code", failures: attempt.state?.failures });
    const lock = retryAfter(attempt.state, now);
    if (lock > 0) return { status: "error", error: "throttled", retryAt: now + lock };
    return { status: "error", error: "wrong", triesLeft: triesLeft(attempt.state, now, ADDRESS_POLICY) };
  }

  (await cookies()).set({ name: roomCookieName(room.code), value: roomAccessToken(room.id, room.passwordHash), ...roomCookieOptions() });
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
  const attempt = store.kind === "supabase" ? await takeTry(scope, now, ADDRESS_POLICY) : ({ allowed: true, state: null } as const);
  if (!attempt.allowed) return { ok: false, error: "throttled", retryAt: attempt.retryAt };

  if (!isValidInviteKey(typeof key === "string" ? key : "", room.id, room.passwordHash)) {
    log.info("Room unlock failed", { room: room.code, reason: "invite key", failures: attempt.state?.failures });
    return { ok: false, error: "wrong" };
  }
  (await cookies()).set({ name: roomCookieName(room.code), value: roomAccessToken(room.id, room.passwordHash), ...roomCookieOptions() });
  if (attempt.state) await clearThrottle(scope);
  log.info("Room unlocked", { room: room.code, via: "invite link" });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Leaders (their own row, with the token their device keeps)
// ---------------------------------------------------------------------------

type Opened = { store: RallyStore; room: RoomRow };

/** The room, if it is open and this visitor unlocked it. */
async function openUnlocked(code: string): Promise<Opened | { error: SyncError }> {
  const found = await findOpenRoom(code);
  if ("problem" in found) return { error: found.problem };
  if (!(await hasRoomAccess(found.room))) return { error: "locked" };
  return found;
}

function storeError(error: unknown, log: Logger, what: string): { ok: false; error: SyncError } {
  if (error instanceof RallyStoreError) {
    const problem = error.problem;
    if (problem === "room_limit" || problem === "leader_limit" || problem === "total_limit") return { ok: false, error: problem };
    if (problem === "room_closed") return { ok: false, error: "closed" };
  }
  log.error(`${what} failed`, { error: error instanceof Error ? error.message : String(error) });
  return { ok: false, error: "failed" };
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
    if ((await store.leaders(room.id)).length >= MAX_LEADERS_PER_ROOM) return { ok: false, error: "leader_limit" };
    const token = newToken();
    const running = rallyRunning(room.hitAt, toGameTime(Date.now(), clampGameOffset(gameOffsetSeconds)));
    const row = await store.insertLeader({ roomId: room.id, name: leader.name, marchSeconds: leader.marchSeconds, status: joinStatus(running), tokenHash: hashToken(token) });
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
function hitPatch(room: RoomRow, hitAt: number | null, now: number, enemyHitAt: number | null = null): RoomPatch {
  const previous = room.hitAt ? { hitAt: room.hitAt, setAt: room.hitSetAt ?? room.hitAt } : null;
  return {
    hitAt: hitAt === null ? null : new Date(hitAt).toISOString(),
    hitSetAt: hitAt === null ? null : new Date(now).toISOString(),
    enemyHitAt: enemyHitAt === null ? null : new Date(enemyHitAt).toISOString(),
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

/**
 * One coordinator change. `gameOffsetSeconds` is the coordinator's game-clock
 * adjustment: typed times are game times as they are, while Re-sync, "lands
 * in" and the "already passed" check count from the coordinator's game "now".
 */
export async function coordinate(code: string, token: string, op: CoordinatorOp, gameOffsetSeconds = 0): Promise<SyncResult<{ inviteKey?: string }>> {
  const { log } = await context();
  // A direct POST can send anything; the checks below expect a token string and an op object.
  if (typeof token !== "string" || typeof op !== "object" || op === null || typeof op.type !== "string") return { ok: false, error: "invalid" };
  const opened = await openUnlocked(code);
  if ("error" in opened) return { ok: false, error: opened.error };
  const { store, room } = opened;
  if (!tokenMatches(token, room.coordinatorHash)) return { ok: false, error: "not_coordinator" };
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
        if (!settings.ok) return { ok: false, error: "invalid" };
        const patch: RoomPatch = { ...settings.value };
        // Counter-rally: a new offset moves our hit along with it (still the same rally, so waiting march times keep waiting).
        if (settings.value.mode === "counter" && room.enemyHitAt && settings.value.counterOffsetSeconds !== room.counterOffsetSeconds) {
          const enemy = Date.parse(room.enemyHitAt);
          Object.assign(patch, hitPatch(room, counterHit(enemy, settings.value.counterOffsetSeconds), now, enemy));
        }
        await store.updateRoom(room.id, patch);
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
      case "enemyClock":
      case "enemyIn": {
        const text = String(op.text ?? "");
        const seconds = op.type === "enemyIn" ? parseDuration(text) : null;
        const enemy = op.type === "enemyIn" ? (seconds === null ? null : Math.round((now + seconds * 1000) / 1000) * 1000) : parseUtcClock(text, now);
        if (enemy === null) return { ok: false, error: "invalid" };
        const hitAt = counterHit(enemy, room.counterOffsetSeconds);
        if (hitAt <= now) return { ok: false, error: "past" };
        await startNextRally(store, await store.leaders(room.id));
        await store.updateRoom(room.id, { ...hitPatch(room, ceilToSecond(hitAt), now, enemy), mode: "counter" });
        return done();
      }
      case "clearHit": {
        await startNextRally(store, await store.leaders(room.id));
        await store.updateRoom(room.id, hitPatch(room, null, now));
        return done();
      }
      case "addLeader": {
        const leader = parseLeader(op);
        if (!leader) return { ok: false, error: "invalid" };
        if ((await store.leaders(room.id)).length >= MAX_LEADERS_PER_ROOM) return { ok: false, error: "leader_limit" };
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
        // Everyone else is locked out now; the coordinator stays in.
        (await cookies()).set({ name: roomCookieName(room.code), value: roomAccessToken(room.id, passwordHash), ...roomCookieOptions() });
        done();
        return { ok: true, inviteKey: inviteKey(room.id, passwordHash) };
      }
      case "invite":
        return { ok: true, inviteKey: inviteKey(room.id, room.passwordHash) };
      case "destroy": {
        await store.deleteRoom(room.id);
        (await cookies()).delete(roomCookieName(room.code));
        return done();
      }
      default:
        return { ok: false, error: "invalid" };
    }
  } catch (error) {
    return storeError(error, log, `Coordinator action ${op.type}`);
  }
}
