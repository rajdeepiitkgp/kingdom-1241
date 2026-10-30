import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/cookies";

describe("session cookie options", () => {
  it("keep the session out of scripts and off cross-site requests; Secure follows the environment", () => {
    expect(SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(SESSION_COOKIE_OPTIONS.sameSite).toBe("lax");
    expect(SESSION_COOKIE_OPTIONS.secure).toBe(process.env.NODE_ENV === "production");
  });
});
