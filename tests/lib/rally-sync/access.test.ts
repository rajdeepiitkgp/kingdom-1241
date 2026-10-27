import { describe, expect, it } from "vitest";
import {
  hashPassword,
  hashToken,
  inviteKey,
  isValidInviteKey,
  isValidRoomToken,
  newChannelKey,
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
