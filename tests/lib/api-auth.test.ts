import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorized } from "@/lib/api-auth";

function request(headers: Record<string, string>): Request {
  return new Request("https://example.test/api/translate", { method: "POST", headers });
}

describe("isAuthorized", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses everything while no secret is configured", () => {
    vi.stubEnv("TRANSLATE_WEBHOOK_SECRET", "");
    expect(isAuthorized(request({ authorization: "Bearer " }))).toBe(false);
    expect(isAuthorized(request({ authorization: "Bearer anything" }))).toBe(false);
  });

  it("accepts the secret as a bearer token (any case) or in x-webhook-secret", () => {
    vi.stubEnv("TRANSLATE_WEBHOOK_SECRET", " s3cret ");
    expect(isAuthorized(request({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(isAuthorized(request({ authorization: "bearer s3cret" }))).toBe(true);
    expect(isAuthorized(request({ "x-webhook-secret": "s3cret" }))).toBe(true);
  });

  it("refuses a missing, wrong, shorter or longer secret", () => {
    vi.stubEnv("TRANSLATE_WEBHOOK_SECRET", "s3cret");
    expect(isAuthorized(request({}))).toBe(false);
    expect(isAuthorized(request({ authorization: "Bearer s3cres" }))).toBe(false);
    expect(isAuthorized(request({ authorization: "Bearer s3cre" }))).toBe(false);
    expect(isAuthorized(request({ authorization: "Bearer s3cret1" }))).toBe(false);
    expect(isAuthorized(request({ authorization: "Basic s3cret" }))).toBe(false);
  });

  it("can check a different variable", () => {
    vi.stubEnv("OTHER_SECRET", "abc");
    expect(isAuthorized(request({ authorization: "Bearer abc" }), "OTHER_SECRET")).toBe(true);
    expect(isAuthorized(request({ authorization: "Bearer abc" }))).toBe(false);
  });
});
