import { describe, expect, it } from "vitest";
import { hasSessionCookie, isAdminPath } from "@/lib/auth/session-hint";

describe("hasSessionCookie", () => {
  it("finds the Supabase session cookie, chunked or not", () => {
    expect(hasSessionCookie("theme=dark; sb-hjbbjzwiykeovmvwujvb-auth-token=base64-abc")).toBe(true);
    expect(hasSessionCookie("sb-hjbbjzwiykeovmvwujvb-auth-token.0=x; sb-hjbbjzwiykeovmvwujvb-auth-token.1=y")).toBe(true);
  });
  it("ignores other cookies and the code verifier", () => {
    expect(hasSessionCookie("")).toBe(false);
    expect(hasSessionCookie("kd1241_kvk=abc; sb-hjbbjzwiykeovmvwujvb-auth-token-code-verifier=zzz")).toBe(false);
  });
});

describe("isAdminPath", () => {
  it("matches the admin area only", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/login")).toBe(true);
    expect(isAdminPath("/administration")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
  });
});
