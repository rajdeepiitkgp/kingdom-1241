import { describe, expect, it } from "vitest";
import { secureCookies } from "@/lib/secure-cookies";

describe("secure cookies", () => {
  it("are Secure in every production build and plain in development", () => {
    expect(secureCookies({ NODE_ENV: "production" })).toBe(true);
    expect(secureCookies({ NODE_ENV: "production", VERCEL: "1" })).toBe(true);
    expect(secureCookies({ NODE_ENV: "development" })).toBe(false);
  });

  it("drop the flag only for the browser tests' local server, never on Vercel", () => {
    expect(secureCookies({ NODE_ENV: "production", E2E_HTTP_COOKIES: "1" })).toBe(false);
    expect(secureCookies({ NODE_ENV: "production", E2E_HTTP_COOKIES: "1", VERCEL: "1" })).toBe(true);
    expect(secureCookies({ NODE_ENV: "production", E2E_HTTP_COOKIES: "true" })).toBe(true);
  });
});
