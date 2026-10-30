// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { kvkSessionSecret } from "@/lib/kvk/access";
import { secureCookies } from "@/lib/secure-cookies";
import { randomInstanceTag, randomRoomCode } from "./room";

/**
 * Secrets of Rally Sync rooms (server only). The room password is stored as
 * an scrypt hash. A correct password (or a valid invite link) makes the
 * browser an instance of the room (rally_sync_instances) and gives it an
 * HttpOnly cookie per room naming that instance, signed with the room id: a
 * password change keeps everyone who is in, and the coordinator removes one
 * browser by deleting its instance. The invite key is an HMAC of the room id
 * and the password hash, so a new password kills old links; it is carried in
 * the link's #fragment (browsers never send it to the server, so it stays out
 * of request logs). Coordinator and leader tokens are random and stored as
 * sha256 hashes. Like the KvK locks this keeps other kingdoms out; it is not
 * account security.
 */

export const ROOM_COOKIE_PREFIX = "kd1241_rs_";
/** A room never lives longer than a day, nor does its cookie. */
export const ROOM_COOKIE_MAX_AGE = 60 * 60 * 24;

export function roomCookieName(code: string): string {
  return `${ROOM_COOKIE_PREFIX}${code}`;
}

export function roomCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: secureCookies(), path: "/", maxAge: ROOM_COOKIE_MAX_AGE };
}

const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 32 };

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key))));
}

/** "scrypt$N$r$p$salt$hash" (base64url parts). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.trim(), salt, SCRYPT.keyLength, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash || !password.trim()) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await scryptAsync(password.trim(), Buffer.from(salt, "base64url"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

function sign(label: string, roomId: string, passwordHash: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${label}\u0000${roomId}\u0000${passwordHash}`).digest();
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/** The room cookie of an instance: `<instance id>.<signature>`, bound to the room but not to the password. */
export function instanceCookieValue(roomId: string, instanceId: string, secret = kvkSessionSecret()): string {
  return `${instanceId}.${sign("rally-sync-instance", roomId, instanceId, secret).toString("base64url")}`;
}

/** The instance id in a room cookie whose signature is valid for this room, else null (the instance must still exist; see session.ts). */
export function instanceIdFromCookie(value: string | undefined | null, roomId: string, secret = kvkSessionSecret()): string | null {
  if (typeof value !== "string") return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const instanceId = value.slice(0, dot);
  return safeEqual(value, instanceCookieValue(roomId, instanceId, secret)) ? instanceId : null;
}

/**
 * The room cookie from before instances existed (migration 0014): an HMAC of the
 * room id and the password hash. Still accepted, and still issued while a deploy
 * runs ahead of its migration; such a browser isn't in the coordinator's list and
 * leaves with the next password change, as before.
 */
export function roomAccessToken(roomId: string, passwordHash: string, secret = kvkSessionSecret()): string {
  return sign("rally-sync", roomId, passwordHash, secret).toString("hex");
}

export function isValidRoomToken(token: string | undefined | null, roomId: string, passwordHash: string, secret = kvkSessionSecret()): boolean {
  return Boolean(token) && safeEqual(token as string, roomAccessToken(roomId, passwordHash, secret));
}

/** The key in the invite link (`#k=…`), 22 characters. */
export function inviteKey(roomId: string, passwordHash: string, secret = kvkSessionSecret()): string {
  return sign("rally-sync-invite", roomId, passwordHash, secret).subarray(0, 16).toString("base64url");
}

export function isValidInviteKey(key: string | undefined | null, roomId: string, passwordHash: string, secret = kvkSessionSecret()): boolean {
  return Boolean(key) && safeEqual(key as string, inviteKey(roomId, passwordHash, secret));
}

/** A coordinator or leader token (32 characters, base64url). */
export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: unknown, hash: string | null): boolean {
  return typeof token === "string" && token !== "" && Boolean(hash) && safeEqual(hashToken(token), hash as string);
}

/** The Realtime topic suffix of a room. */
export function newChannelKey(): string {
  return randomBytes(16).toString("hex");
}

export function newInstanceTag(): string {
  const bytes = randomBytes(32);
  let i = 0;
  return randomInstanceTag(() => (i < bytes.length ? bytes[i++] : randomBytes(1)[0]));
}

export function newRoomCode(): string {
  const bytes = randomBytes(64);
  let i = 0;
  return randomRoomCode(() => (i < bytes.length ? bytes[i++] : randomBytes(1)[0]));
}
