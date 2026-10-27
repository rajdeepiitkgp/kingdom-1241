// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import type { RetroResponse } from "@/lib/data/types";
import {
  analysisPrompt,
  analysisSchema,
  englishTexts,
  needsTranslation,
  parseAnalysis,
  parseTranslationBatch,
  readStoredAnalysis,
  translationBatches,
  translationPrompt,
  translationSchema,
} from "@/lib/retro/analysis";
import { defaultConfig } from "@/lib/retro/questions";

function response(id: string, texts: Partial<RetroResponse["texts"]>, extra: Partial<RetroResponse> = {}): RetroResponse {
  return {
    id,
    retrospectiveId: "r",
    governorId: null,
    gameName: null,
    allianceTag: "NAM",
    verified: false,
    ratings: { overall: 4 },
    texts: { went_well: "", went_wrong: "", suggestions: "", ...texts },
    textsEn: null,
    translatedAt: null,
    locale: "de",
    createdAt: "2026-10-25T10:00:00.000Z",
    ...extra,
  };
}

const TEXT_KEYS = ["went_well", "went_wrong", "suggestions"] as const;

describe("translation step", () => {
  it("batches only responses with text and no English yet", () => {
    const rows = [
      response("a", { went_well: "Alles gut" }),
      response("b", {}),
      response("c", { suggestions: "Mehr Schilde" }, { textsEn: { suggestions: "More shields" } }),
      response("d", { went_wrong: "Zu spät" }),
    ];
    expect(rows.map(needsTranslation)).toEqual([true, false, false, true]);
    expect(translationBatches(rows, 1).map((b) => b.map((r) => r.id))).toEqual([["a"], ["d"]]);
    expect(englishTexts(rows[2])).toEqual({ went_well: "", went_wrong: "", suggestions: "More shields" });
    expect(englishTexts(rows[0]).went_well).toBe("Alles gut");
  });

  it("builds a prompt with ids and page language, and a strict schema", () => {
    const prompt = translationPrompt([response("a", { went_well: "Alles gut" })]);
    expect(prompt).toContain('"id": "a"');
    expect(prompt).toContain('"page_language": "de"');
    expect(prompt).toContain("Alles gut");
    const schema = translationSchema() as { properties: { items: { items: { required: string[] } } } };
    expect(schema.properties.items.items.required).toEqual(["id", ...TEXT_KEYS]);
  });

  it("keeps complete items, drops unknown ids and empty translations of non-empty texts", () => {
    const batch = [response("a", { went_well: "Alles gut", suggestions: "Mehr" }), response("b", { went_wrong: "Nein" })];
    const parsed = parseTranslationBatch(
      {
        items: [
          { id: "a", went_well: "All good", went_wrong: "", suggestions: "More" },
          { id: "b", went_well: "", went_wrong: "", suggestions: "" }, // empty for a non-empty source
          { id: "zzz", went_well: "x", went_wrong: "x", suggestions: "x" },
        ],
      },
      batch,
    );
    expect([...parsed.keys()]).toEqual(["a"]);
    expect(parsed.get("a")).toEqual({ went_well: "All good", went_wrong: "", suggestions: "More" });
    expect(parseTranslationBatch("garbage", batch).size).toBe(0);
  });
});

describe("summary step", () => {
  const config = defaultConfig();
  const context = { title: "Castle Battle", eventType: "castle_battle", battleAt: "2026-10-24T21:00:00.000Z", ratingLabels: { overall: "Overall" }, textLabels: { went_well: "What went well?" } };

  it("lists every response with alliance, ratings and English texts", () => {
    const rows = [response("a", { went_well: "Alles gut" }, { textsEn: { went_well: "All good" } }), response("b", {}, { allianceTag: null, ratings: {} })];
    const { prompt, omittedTexts } = analysisPrompt(rows, config, context);
    expect(prompt).toContain("Castle Battle (internal castle battle, 2026-10-24)");
    expect(prompt).toContain("overall = Overall");
    expect(prompt).toContain("#1 [NAM] overall=4 planning=- coordination=- formations=- | went_well: All good");
    expect(prompt).toContain("#2 [none] overall=- planning=-");
    expect(prompt).not.toContain("Alles gut");
    expect(omittedTexts).toBe(0);
  });

  it("drops the oldest texts, never the ratings, when the request would be too large", () => {
    const rows = Array.from({ length: 5 }, (_, i) => response(`r${i}`, { went_well: "x".repeat(200) }));
    const { prompt, omittedTexts } = analysisPrompt(rows, config, context, 700);
    expect(omittedTexts).toBeGreaterThan(0);
    expect(omittedTexts).toBeLessThan(5);
    expect(prompt).toContain("#5 [NAM] overall=4");
    expect(prompt).toContain("listed with ratings only");
  });

  it("schema names the shown prompts and their sentiment", () => {
    const schema = analysisSchema(["went_well", "suggestions"]) as { properties: { sentiment: { required: string[] }; themes: { items: { properties: { prompt: { enum: string[] } } } } } };
    expect(schema.properties.sentiment.required).toEqual(["went_well", "suggestions"]);
    expect(schema.properties.themes.items.properties.prompt.enum).toEqual(["went_well", "suggestions"]);
  });

  it("validates, clamps and sorts the model's reply", () => {
    const meta = { model: "claude-opus-5-5", usage: { requests: 2, inputTokens: 1000, outputTokens: 200 } };
    const analysis = parseAnalysis(
      {
        mood: 7,
        summary: "  Went well overall.  ",
        sentiment: { went_well: { positive: 80, neutral: 10, negative: 10 }, went_wrong: { positive: 1, neutral: 1, negative: 2 } },
        themes: [
          { prompt: "went_wrong", title: "Late shields", count: 3, quote: "Shield came late" },
          { prompt: "went_well", title: "Good calls", count: 9, quote: "" },
          { prompt: "nope", title: "x", count: 1, quote: "" },
          { prompt: "went_well", title: "", count: 2, quote: "" },
        ],
        actions: ["Pin a checklist", "", 42, "Second action"],
      },
      TEXT_KEYS,
      meta,
    );
    expect(analysis).not.toBeNull();
    expect(analysis!.mood).toBe(5);
    expect(analysis!.summary).toBe("Went well overall.");
    expect(analysis!.sentiment.went_well).toEqual({ positive: 80, neutral: 10, negative: 10 });
    expect(analysis!.sentiment.went_wrong).toEqual({ positive: 25, neutral: 25, negative: 50 });
    expect(analysis!.sentiment.suggestions).toEqual({ positive: 0, neutral: 0, negative: 0 });
    expect(analysis!.themes.map((t) => t.title)).toEqual(["Good calls", "Late shields"]);
    expect(analysis!.actions).toEqual(["Pin a checklist", "Second action"]);
    expect(analysis!.model).toBe("claude-opus-5-5");
    expect(parseAnalysis({ mood: 3 }, TEXT_KEYS, meta)).toBeNull();
    expect(parseAnalysis(null, TEXT_KEYS, meta)).toBeNull();
  });

  it("reads a stored analysis back and treats damage as absent", () => {
    const stored = readStoredAnalysis({ version: 1, mood: 3.5, summary: "ok", sentiment: {}, themes: [], actions: [], model: "m", usage: { requests: 1, inputTokens: 10, outputTokens: 5 } });
    expect(stored?.mood).toBe(3.5);
    expect(stored?.usage).toEqual({ requests: 1, inputTokens: 10, outputTokens: 5 });
    expect(readStoredAnalysis({ mood: "high" })).toBeNull();
    expect(readStoredAnalysis(null)).toBeNull();
  });
});
