import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { kvkSessionSecret } from "@/lib/kvk/access";
import { randomRoomCode } from "./room";

/**
 * Secrets of Rally Sync rooms (server only). The room password is stored as
 * an scrypt hash; after a correct password (or a valid invite link) the
 * visitor gets an HttpOnly cookie per room holding an HMAC of the room id and
 * that hash, so changing the password logs everyone out and invalidates old
 * invite links at once. The invite key is a second HMAC over the same values,
 * carried in the link's #fragment (browsers never send it to the server, so it
 * stays out of request logs). Coordinator and leader tokens are random and
 * stored as sha256 hashes. Like the KvK locks this keeps other kingdoms out;
 * it is not account security.
 */

export const ROOM_COOKIE_PREFIX = "kd1241_rs_";
/** A room never lives longer than a day, nor does its cookie. */
export const ROOM_COOKIE_MAX_AGE = 60 * 60 * 24;

export function roomCookieName(code: string): string {
  return `${ROOM_COOKIE_PREFIX}${code}`;
}

export function roomCookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: ROOM_COOKIE_MAX_AGE };
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

/** The room cookie's value. */
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

export function tokenMatches(token: string | undefined | null, hash: string | null): boolean {
  return Boolean(token && hash) && safeEqual(hashToken(token as string), hash as string);
}

/** The Realtime topic suffix of a room. */
export function newChannelKey(): string {
  return randomBytes(16).toString("hex");
}

export function newRoomCode(): string {
  const bytes = randomBytes(64);
  let i = 0;
  return randomRoomCode(() => (i < bytes.length ? bytes[i++] : randomBytes(1)[0]));
}
