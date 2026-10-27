// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashToken,
  instanceCookieValue,
  instanceIdFromCookie,
  inviteKey,
  isValidInviteKey,
  isValidRoomToken,
  newChannelKey,
  newInstanceTag,
  newRoomCode,
  newToken,
  roomAccessToken,
  roomCookieName,
  tokenMatches,
  verifyPassword,
} from "@/lib/rally-sync/access";
import { normalizeRoomCode } from "@/lib/rally-sync/room";

describe("rally sync access", () => {
  const secret = "test-secret";

  it("hashes the room password with a salt and verifies it (trimmed)", async () => {
    const stored = await hashPassword("castle-123");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(stored).not.toContain("castle");
    expect(await hashPassword("castle-123")).not.toBe(stored);
    expect(await verifyPassword("castle-123", stored)).toBe(true);
    expect(await verifyPassword("  castle-123 ", stored)).toBe(true);
    expect(await verifyPassword("castle-124", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
    expect(await verifyPassword("castle-123", "plain-text")).toBe(false);
  });

  it("signs the room cookie with the room and its password hash", () => {
    const token = roomAccessToken("room-1", "hash-a", secret);
    expect(isValidRoomToken(token, "room-1", "hash-a", secret)).toBe(true);
    // A new password (new hash) logs everyone out; another room or secret never matches.
    expect(isValidRoomToken(token, "room-1", "hash-b", secret)).toBe(false);
    expect(isValidRoomToken(token, "room-2", "hash-a", secret)).toBe(false);
    expect(isValidRoomToken(token, "room-1", "hash-a", "other")).toBe(false);
    expect(isValidRoomToken(undefined, "room-1", "hash-a", secret)).toBe(false);
    expect(roomCookieName("K7M4QX")).toBe("kd1241_rs_K7M4QX");
  });

  it("makes an invite key that differs from the cookie and dies with the password", () => {
    const key = inviteKey("room-1", "hash-a", secret);
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(key).not.toBe(roomAccessToken("room-1", "hash-a", secret));
    expect(isValidInviteKey(key, "room-1", "hash-a", secret)).toBe(true);
    expect(isValidInviteKey(key, "room-1", "hash-b", secret)).toBe(false);
    expect(isValidInviteKey("", "room-1", "hash-a", secret)).toBe(false);
  });

  it("stores tokens as hashes and compares them", () => {
    const token = newToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(newToken()).not.toBe(token);
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenMatches(token, hash)).toBe(true);
    expect(tokenMatches(newToken(), hash)).toBe(false);
    expect(tokenMatches(token, null)).toBe(false);
    expect(tokenMatches(null, hash)).toBe(false);
  });

  it("draws valid room codes and channel keys", () => {
    for (let i = 0; i < 50; i++) expect(normalizeRoomCode(newRoomCode())).not.toBeNull();
    expect(newChannelKey()).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("tokenMatches with a hand-crafted request", () => {
  it("refuses anything that isn't a token string instead of throwing", () => {
    const hash = hashToken("secret-token");
    expect(tokenMatches("secret-token", hash)).toBe(true);
    for (const value of [undefined, null, 42, {}, ["secret-token"], ""]) expect(tokenMatches(value, hash)).toBe(false);
    expect(tokenMatches("secret-token", null)).toBe(false);
  });
});

describe("instance cookies", () => {
  const secret = "test-secret";
  const roomId = "11111111-1111-4111-8111-111111111111";
  const instanceId = "22222222-2222-4222-8222-222222222222";

  it("names the instance, signed for its room only", () => {
    const value = instanceCookieValue(roomId, instanceId, secret);
    expect(value.startsWith(`${instanceId}.`)).toBe(true);
    expect(instanceIdFromCookie(value, roomId, secret)).toBe(instanceId);
    expect(instanceIdFromCookie(value, "33333333-3333-4333-8333-333333333333", secret)).toBeNull();
    expect(instanceIdFromCookie(value, roomId, "another-secret")).toBeNull();
  });

  it("refuses a swapped instance id, a cut signature and the old password-bound cookie", () => {
    const value = instanceCookieValue(roomId, instanceId, secret);
    const signature = value.slice(value.indexOf(".") + 1);
    expect(instanceIdFromCookie(`44444444-4444-4444-8444-444444444444.${signature}`, roomId, secret)).toBeNull();
    expect(instanceIdFromCookie(value.slice(0, -2), roomId, secret)).toBeNull();
    expect(instanceIdFromCookie(roomAccessToken(roomId, "scrypt$hash", secret), roomId, secret)).toBeNull();
    for (const junk of [undefined, null, "", ".", `.${signature}`]) expect(instanceIdFromCookie(junk, roomId, secret)).toBeNull();
  });

  it("draws random four-character tags", () => {
    expect(newInstanceTag()).toMatch(/^[A-HJKMNP-Z2-9]{4}$/);
  });
});
