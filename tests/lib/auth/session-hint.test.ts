import { describe, expect, it } from "vitest";
import { ADMIN_MARKER_COOKIE, hasSessionMarker, isAdminPath, markerCookieOptions } from "@/lib/auth/session-hint";

describe("hasSessionMarker", () => {
  it("finds the marker cookie and nothing else", () => {
    expect(hasSessionMarker(`theme=dark; ${ADMIN_MARKER_COOKIE}=1`)).toBe(true);
    expect(hasSessionMarker("")).toBe(false);
    expect(hasSessionMarker(`${ADMIN_MARKER_COOKIE}=0; kd1241_kvk=abc`)).toBe(false);
    expect(hasSessionMarker("sb-hjbbjzwiykeovmvwujvb-auth-token=base64-abc")).toBe(false);
  });
  it("is readable by the page but never HttpOnly", () => {
    expect(markerCookieOptions(true)).toMatchObject({ httpOnly: false, secure: true, sameSite: "lax", path: "/" });
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
