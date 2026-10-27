// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetroResponse } from "@/lib/data/types";
import type { Logger } from "@/lib/log";
import { generateJson as defaultGenerate, type GenerateJson, RETRO_ANALYSIS_MODEL, RETRO_TRANSLATE_MODEL } from "./ai";
import {
  ANALYSIS_SYSTEM,
  type AnalysisContext,
  analysisPrompt,
  analysisSchema,
  type AnalysisUsage,
  parseAnalysis,
  parseTranslationBatch,
  type RetroAnalysis,
  translationBatches,
  translationPrompt,
  TRANSLATION_SYSTEM,
  translationSchema,
} from "./analysis";
import { type RetroConfig, shownTexts } from "./questions";

/**
 * "Translate and analyse": first every response with text and no English
 * version yet is translated (batches, a few in parallel, each stored as soon
 * as it is back, so a run that stops halfway has still made progress), then
 * one summary over every response is produced and stored on the
 * retrospective. Idempotent: running it again only pays for new translations
 * and one more summary. Server only; the model calls are injectable for tests.
 */

export interface AnalyseOptions {
  generate?: GenerateJson;
  log?: Logger;
  now?: Date;
  /** How many translation batches run at the same time. */
  concurrency?: number;
}

export interface AnalyseResult {
  translated: number;
  translationFailures: number;
  analysed: number;
  omittedTexts: number;
  analysis: RetroAnalysis;
  usage: AnalysisUsage;
}

export interface AnalyseTarget {
  id: string;
  config: RetroConfig;
  context: AnalysisContext;
}

function addUsage(total: AnalysisUsage, result: { inputTokens: number; outputTokens: number }) {
  total.requests += 1;
  total.inputTokens += result.inputTokens;
  total.outputTokens += result.outputTokens;
}

export async function translateAndAnalyse(admin: SupabaseClient, retro: AnalyseTarget, responses: readonly RetroResponse[], options: AnalyseOptions = {}): Promise<AnalyseResult> {
  const generate = options.generate ?? defaultGenerate;
  const log = options.log;
  const now = options.now ?? new Date();
  const usage: AnalysisUsage = { requests: 0, inputTokens: 0, outputTokens: 0 };
  const translated = new Map<string, Record<string, string>>();
  let translationFailures = 0;

  // 1. Translations, in parallel groups of batches.
  const batches = translationBatches(responses);
  const concurrency = Math.max(1, options.concurrency ?? 3);
  for (let i = 0; i < batches.length; i += concurrency) {
    await Promise.all(
      batches.slice(i, i + concurrency).map(async (batch) => {
        try {
          const result = await generate({
            system: TRANSLATION_SYSTEM,
            prompt: translationPrompt(batch),
            schema: translationSchema(),
            model: RETRO_TRANSLATE_MODEL,
            effort: "low",
          });
          addUsage(usage, result);
          const texts = parseTranslationBatch(result.data, batch);
          for (const r of batch) {
            const en = texts.get(r.id);
            if (!en) {
              translationFailures += 1;
              continue;
            }
            const { error } = await admin.from("kvk_retro_responses").update({ texts_en: en, translated_at: now.toISOString() }).eq("id", r.id);
            if (error) {
              translationFailures += 1;
              log?.warn("Could not store a translation", { id: r.id, error: error.message });
            } else {
              translated.set(r.id, en);
            }
          }
        } catch (error) {
          translationFailures += batch.length;
          log?.warn("A translation batch failed", { size: batch.length, error: error instanceof Error ? error.message : String(error) });
        }
      }),
    );
  }

  // 2. The summary over everything, with the fresh translations applied in memory.
  const withEnglish = responses.map((r) => (translated.has(r.id) ? { ...r, textsEn: translated.get(r.id) as RetroResponse["textsEn"] } : r));
  const textKeys = shownTexts(retro.config).map((t) => t.key);
  const input = analysisPrompt(withEnglish, retro.config, retro.context);
  const result = await generate({
    system: ANALYSIS_SYSTEM,
    prompt: input.prompt,
    schema: analysisSchema(textKeys),
    model: RETRO_ANALYSIS_MODEL,
    effort: "high",
  });
  addUsage(usage, result);
  const analysis = parseAnalysis(result.data, textKeys, { model: result.model, usage });
  if (!analysis) throw new Error("The model's summary did not have the expected shape; nothing was stored.");

  const { error } = await admin
    .from("kvk_retrospectives")
    .update({ analysis, analysis_at: now.toISOString(), analysis_count: responses.length })
    .eq("id", retro.id);
  if (error) throw new Error(`Storing the analysis failed: ${error.message}`);

  return { translated: translated.size, translationFailures, analysed: responses.length, omittedTexts: input.omittedTexts, analysis, usage };
}
