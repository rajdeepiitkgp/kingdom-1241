import { describe, expect, it } from "vitest";
import { areaAccessToken, isValidAreaToken, isValidKvkToken, KVK_AREA_COOKIES, kvkAccessToken, passwordMatches } from "@/lib/kvk/access";

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

describe("area access tokens (one password and cookie per locked page)", () => {
  const secret = "test-secret";

  it("keeps the battle plan's original token, so cookies already handed out stay valid", () => {
    expect(areaAccessToken("plan", "plan-1", "castle", secret)).toBe(kvkAccessToken("plan-1", "castle", secret));
  });

  it("gives the leader page a different token even with the same password", () => {
    const leaders = areaAccessToken("leaders", "plan-1", "castle", secret);
    expect(leaders).not.toBe(areaAccessToken("plan", "plan-1", "castle", secret));
    // A battle-plan cookie never opens the leader page, and the other way round.
    expect(isValidAreaToken("leaders", kvkAccessToken("plan-1", "castle", secret), "plan-1", "castle", secret)).toBe(false);
    expect(isValidAreaToken("plan", leaders, "plan-1", "castle", secret)).toBe(false);
    expect(isValidAreaToken("leaders", leaders, "plan-1", "castle", secret)).toBe(true);
  });

  it("stops working when the leaders' password or the plan changes", () => {
    const leaders = areaAccessToken("leaders", "plan-1", "rally", secret);
    expect(isValidAreaToken("leaders", leaders, "plan-1", "rally2", secret)).toBe(false);
    expect(isValidAreaToken("leaders", leaders, "plan-2", "rally", secret)).toBe(false);
    expect(isValidAreaToken("leaders", undefined, "plan-1", "rally", secret)).toBe(false);
  });

  it("uses a separate cookie per page", () => {
    expect(new Set(Object.values(KVK_AREA_COOKIES)).size).toBe(Object.keys(KVK_AREA_COOKIES).length);
    expect(KVK_AREA_COOKIES.plan).toBe("kd1241_kvk");
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
