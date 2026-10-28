// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { RetroResponse } from "@/lib/data/types";
import { RETRO_TRANSLATE_MODEL, type GenerateJsonRequest } from "@/lib/retro/ai";
import { translateResponses } from "@/lib/retro/analyse";
import { TRANSLATION_SYSTEM } from "@/lib/retro/analysis";

const response = (id: string, wentWell: string, textsEn: RetroResponse["textsEn"] = null): RetroResponse => ({
  id,
  retrospectiveId: "r1",
  governorId: null,
  gameName: null,
  allianceTag: null,
  verified: false,
  ratings: {},
  texts: { went_well: wentWell, went_wrong: "", suggestions: "" },
  textsEn,
  translatedAt: null,
  locale: "de",
  createdAt: "2026-10-28T12:00:00Z",
});

/** Stores nothing; counts the rows the step writes. */
function fakeAdmin() {
  const written: string[] = [];
  const admin = { from: () => ({ update: () => ({ eq: async (_column: string, id: string) => (written.push(id), { error: null }) }) }) };
  return { admin: admin as unknown as SupabaseClient, written };
}

describe("translating feedback answers", () => {
  it("translates only answers without English, with the small model, and never asks for a summary", async () => {
    const calls: GenerateJsonRequest[] = [];
    const responses = [response("a", "Gut gemacht"), response("b", "Schon übersetzt", { went_well: "Already translated" }), response("c", "")];
    const { admin, written } = fakeAdmin();
    const result = await translateResponses(admin, responses, {
      generate: async (request) => {
        calls.push(request);
        return { data: { items: [{ id: "a", went_well: "Well done", went_wrong: "", suggestions: "" }] }, model: request.model, inputTokens: 100, outputTokens: 20 };
      },
    });
    expect(calls.map((c) => c.model)).toEqual([RETRO_TRANSLATE_MODEL]);
    // Both models may be the same (Haiku by default), so the summary request is told apart by its prompt.
    expect(calls.every((c) => c.system === TRANSLATION_SYSTEM)).toBe(true);
    expect([...result.translated.keys()]).toEqual(["a"]);
    expect(written).toEqual(["a"]);
    expect(result.usage).toEqual({ requests: 1, inputTokens: 100, outputTokens: 20 });
  });

  it("makes no model call at all when every answer is already in English", async () => {
    const { admin } = fakeAdmin();
    let called = false;
    const result = await translateResponses(admin, [response("b", "x", { went_well: "x" })], {
      generate: async () => {
        called = true;
        throw new Error("unexpected");
      },
    });
    expect(called).toBe(false);
    expect(result.translated.size).toBe(0);
  });
});
