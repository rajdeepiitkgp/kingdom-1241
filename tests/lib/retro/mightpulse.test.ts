// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lookupGovernor } from "@/lib/retro/mightpulse";

const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("lookupGovernor", () => {
  const before = process.env.MIGHTPULSE_API_KEY;
  beforeEach(() => {
    process.env.MIGHTPULSE_API_KEY = "test-key";
  });
  afterEach(() => {
    if (before === undefined) delete process.env.MIGHTPULSE_API_KEY;
    else process.env.MIGHTPULSE_API_KEY = before;
  });

  it("takes a stored copy as it is: an old one still names the player", async () => {
    const fetchImpl = answer(200, { ok: true, fresh: false, refresh: "queued", retry_after: 5, player: { nick_name: "Rudy", kid: 1241, power: 1000, alliance: { abbr: "NAM" } } });
    expect(await lookupGovernor("12345678", { fetchImpl })).toEqual({ status: "found", profile: { governorId: "12345678", name: "Rudy", allianceTag: "NAM", kingdom: 1241, power: 1000 } });
  });

  it("sends no wait: the forms need the name, not the newest numbers", async () => {
    let asked = "";
    const fetchImpl = (async (url: string) => {
      asked = url;
      return new Response(JSON.stringify({ player: { nick_name: "Rudy", kid: 1241 } }), { status: 200 });
    }) as unknown as typeof fetch;
    await lookupGovernor("12345678", { fetchImpl });
    expect(asked).toMatch(/\/players\/12345678\?include=base$/);
  });

  it("reads 202 (a player MightPulse is seeing for the first time) as not yet, never as unknown", async () => {
    expect(await lookupGovernor("12345678", { fetchImpl: answer(202, { ok: true, pending: true }) })).toEqual({ status: "unavailable" });
  });

  it("blocks only on a clear 404", async () => {
    expect(await lookupGovernor("12345678", { fetchImpl: answer(404, { ok: false }) })).toEqual({ status: "unknown" });
    expect(await lookupGovernor("12345678", { fetchImpl: answer(429, { ok: false }) })).toEqual({ status: "unavailable" });
    expect(await lookupGovernor("12345678", { fetchImpl: answer(500, {}) })).toEqual({ status: "unavailable" });
  });

  it("is unavailable without a key", async () => {
    delete process.env.MIGHTPULSE_API_KEY;
    expect(await lookupGovernor("12345678", { fetchImpl: answer(200, {}) })).toEqual({ status: "unavailable" });
  });
});
