// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { GOVERNOR_TOKEN_MAX_AGE, parseMightPulsePlayer, signGovernor, verifyGovernor } from "@/lib/retro/governor";

const SECRET = "test-secret";
const NOW = Date.parse("2026-10-25T12:00:00Z");

describe("parseMightPulsePlayer", () => {
  it("reads the name, kingdom and alliance tag from the documented shape", () => {
    const profile = parseMightPulsePlayer(
      { ok: true, governor_id: "12345678", player: { nick_name: "Rudy", kid: 1241, power: 1, alliance: { abbr: "nam", name: "Namaste" } } },
      "12345678",
    );
    expect(profile).toEqual({ governorId: "12345678", name: "Rudy", allianceTag: "nam", kingdom: 1241 });
  });

  it("copes with a missing alliance or kingdom and rejects an answer without a name", () => {
    expect(parseMightPulsePlayer({ player: { nick_name: "Solo" } }, "1")).toEqual({ governorId: "1", name: "Solo", allianceTag: null, kingdom: null });
    expect(parseMightPulsePlayer({ player: { kid: 1241 } }, "1")).toBeNull();
    expect(parseMightPulsePlayer("nope", "1")).toBeNull();
    expect(parseMightPulsePlayer({ player: { nick_name: "x".repeat(60) } }, "1")?.name).toHaveLength(40);
  });
});

describe("governor tokens", () => {
  const profile = { governorId: "12345678", name: "Rudy", allianceTag: "NAM", kingdom: 1241 };

  it("round-trip for the same retrospective within the lifetime", () => {
    const token = signGovernor(profile, "retro-1", NOW, SECRET);
    expect(verifyGovernor(token, "retro-1", NOW + 60_000, SECRET)).toEqual(profile);
  });

  it("rejects another retrospective, a tampered payload, another secret and an old token", () => {
    const token = signGovernor(profile, "retro-1", NOW, SECRET);
    expect(verifyGovernor(token, "retro-2", NOW, SECRET)).toBeNull();
    expect(verifyGovernor(token, "retro-1", NOW, "other")).toBeNull();
    expect(verifyGovernor(token, "retro-1", NOW + GOVERNOR_TOKEN_MAX_AGE + 1, SECRET)).toBeNull();
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), n: "Someone else" })).toString("base64url")}.${signature}`;
    expect(verifyGovernor(forged, "retro-1", NOW, SECRET)).toBeNull();
    expect(verifyGovernor("", "retro-1", NOW, SECRET)).toBeNull();
    expect(verifyGovernor("garbage", "retro-1", NOW, SECRET)).toBeNull();
  });
});
