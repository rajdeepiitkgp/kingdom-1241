import { describe, expect, it } from "vitest";
import { mapOpenRetrospective, mapRetroResponse, mapRetrospective } from "@/lib/data/mappers";

describe("retrospective mappers", () => {
  const row = {
    id: "r1",
    plan_id: "p1",
    open: true,
    title: { en: "Feedback", de: "Rückmeldung" },
    intro: { en: "<p>Hi</p>" },
    intro_source: { en: "Hi" },
    config: { ratings: { overall: { shown: true, required: false } } },
    closes_at: "2026-11-05T20:00:00+00:00",
    max_responses: "300",
    retention_days: 14,
    created_at: "2026-10-25T10:00:00+00:00",
    updated_at: "2026-10-25T11:00:00+00:00",
  };

  it("maps a retrospective with its parsed config", () => {
    const retro = mapRetrospective(row);
    expect(retro.open).toBe(true);
    expect(retro.config.ratings.overall).toEqual({ shown: true, required: false });
    expect(retro.config.texts.went_well).toEqual({ shown: true, required: false });
    expect(retro.closesAt).toBe("2026-11-05T20:00:00.000Z");
    expect(retro.maxResponses).toBe(300);
    expect(retro.retentionDays).toBe(14);
    expect(mapRetrospective({ ...row, closes_at: null, config: null }).closesAt).toBeNull();
  });

  it("attaches the battle with its password for the gate", () => {
    const open = mapOpenRetrospective(row, { id: "p1", slug: "castle", title: { en: "Castle" }, event_type: "castle_battle", battle_at: null, password: "pw" });
    expect(open.battle).toEqual({ planId: "p1", slug: "castle", title: { en: "Castle" }, eventType: "castle_battle", battleAt: null, password: "pw" });
  });

  it("keeps identity only for the owner and drops out-of-range ratings", () => {
    const response = {
      id: "x",
      retrospective_id: "r1",
      governor_id: "12345678",
      game_name: "Rudy",
      alliance_tag: "NAM",
      verified: true,
      ratings: { overall: 5, planning: 7, bogus: 1 },
      went_well: "yes",
      went_wrong: "",
      suggestions: "more",
      locale: "pl",
      created_at: "2026-10-25T10:00:00+00:00",
    };
    const forOwner = mapRetroResponse(response, true);
    expect(forOwner.governorId).toBe("12345678");
    expect(forOwner.gameName).toBe("Rudy");
    expect(forOwner.ratings).toEqual({ overall: 5 });
    expect(forOwner.texts).toEqual({ went_well: "yes", went_wrong: "", suggestions: "more" });
    const forModerator = mapRetroResponse(response, false);
    expect(forModerator.governorId).toBeNull();
    expect(forModerator.gameName).toBeNull();
    expect(forModerator.allianceTag).toBe("NAM");
  });
});
