import { describe, expect, it } from "vitest";
import { OPT_OUT_KEY, showAnalytics, trackedEvent } from "@/lib/analytics";
import { ADMIN_MARKER_COOKIE } from "@/lib/auth/session-hint";

describe("showAnalytics", () => {
  it("draws the scripts on Vercel only", () => {
    expect(showAnalytics({ VERCEL: "1" })).toBe(true);
    expect(showAnalytics({})).toBe(false);
    expect(showAnalytics({ VERCEL: "" })).toBe(false);
  });
});

describe("trackedEvent", () => {
  const event = { type: "pageview", url: "https://kingdom-1241.vercel.app/de/kvk" };

  it("sends a player's page view unchanged", () => {
    expect(trackedEvent(event, { cookie: "kd1241_lang=de; kd1241_kvk=abc", optOut: null })).toBe(event);
    expect(trackedEvent(event, { cookie: "", optOut: null })).toBe(event);
  });

  it("sends nothing from a signed-in council member's browser", () => {
    expect(trackedEvent(event, { cookie: `theme=dark; ${ADMIN_MARKER_COOKIE}=1`, optOut: null })).toBeNull();
  });

  it("sends nothing from a browser that opted out, whatever the value", () => {
    expect(trackedEvent(event, { cookie: "", optOut: "1" })).toBeNull();
    expect(trackedEvent(event, { cookie: "", optOut: "" })).toBeNull();
  });

  it("uses Vercel's own opt-out key", () => {
    expect(OPT_OUT_KEY).toBe("va-disable");
  });
});
