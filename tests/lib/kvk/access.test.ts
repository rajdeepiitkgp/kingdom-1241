import { describe, expect, it } from "vitest";
import { isValidKvkToken, kvkAccessToken, passwordMatches } from "@/lib/kvk/access";

describe("kvk access tokens", () => {
  const secret = "test-secret";

  it("is deterministic for the same plan, password and secret", () => {
    expect(kvkAccessToken("plan-1", "castle", secret)).toBe(kvkAccessToken("plan-1", "castle", secret));
    expect(kvkAccessToken("plan-1", "castle", secret)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when the password, the plan or the secret changes", () => {
    const base = kvkAccessToken("plan-1", "castle", secret);
    expect(kvkAccessToken("plan-1", "castle2", secret)).not.toBe(base);
    expect(kvkAccessToken("plan-2", "castle", secret)).not.toBe(base);
    expect(kvkAccessToken("plan-1", "castle", "other")).not.toBe(base);
  });

  it("validates the current token and rejects old or missing ones", () => {
    const token = kvkAccessToken("plan-1", "castle", secret);
    expect(isValidKvkToken(token, "plan-1", "castle", secret)).toBe(true);
    // Council changed the password → every existing cookie stops working.
    expect(isValidKvkToken(token, "plan-1", "new-password", secret)).toBe(false);
    expect(isValidKvkToken(undefined, "plan-1", "castle", secret)).toBe(false);
    expect(isValidKvkToken("", "plan-1", "castle", secret)).toBe(false);
    expect(isValidKvkToken("not-a-token", "plan-1", "castle", secret)).toBe(false);
  });

  it("does not expose the password through the token", () => {
    expect(kvkAccessToken("plan-1", "castle", secret)).not.toContain("castle");
  });
});

describe("passwordMatches", () => {
  it("ignores surrounding whitespace but nothing else", () => {
    expect(passwordMatches("  castle ", "castle")).toBe(true);
    expect(passwordMatches("Castle", "castle")).toBe(false);
    expect(passwordMatches("castl", "castle")).toBe(false);
  });

  it("never matches an empty password", () => {
    expect(passwordMatches("", "")).toBe(false);
    expect(passwordMatches("   ", "")).toBe(false);
  });
});
