// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createLogger, elapsedMs } from "@/lib/log";
import { fallbackOptions } from "@/lib/translate/anthropic";
import { GEMINI_MODEL } from "@/lib/translate/gemini";
import { isTranslationConfigured, translationProvider, withRetry } from "@/lib/translate/provider";

/**
 * One JSON-returning model call for the retrospective's AI step, on the same
 * provider switch as the translations (Anthropic when its key is set, else
 * Gemini, else off). Server only.
 *
 * Models (Anthropic): RETRO_TRANSLATE_MODEL for the bulk translation of short
 * player texts and RETRO_ANALYSIS_MODEL for the summary, both Claude Haiku 5.5
 * by default (cents per run; a larger model writes a somewhat better summary
 * at many times the price, so it is a variable away, not the default). Gemini
 * uses GEMINI_MODEL for both. Token usage is returned so the action can log
 * and store the cost.
 */

export const RETRO_TRANSLATE_MODEL = process.env.RETRO_TRANSLATE_MODEL?.trim() || "claude-haiku-5-5";
export const RETRO_ANALYSIS_MODEL = process.env.RETRO_ANALYSIS_MODEL?.trim() || "claude-haiku-5-5";

export interface GenerateJsonRequest {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  model: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}

export interface GenerateJsonResult {
  data: unknown;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export type GenerateJson = (request: GenerateJsonRequest) => Promise<GenerateJsonResult>;

const log = createLogger("retro-ai");

export function retroAiConfigured(): boolean {
  return isTranslationConfigured();
}

/** "anthropic / claude-haiku-5-5" (or "… / translation + summary" when they differ), for the page and the audit log. */
export function retroAiLabel(): string {
  const provider = translationProvider();
  if (provider === "anthropic") {
    return RETRO_TRANSLATE_MODEL === RETRO_ANALYSIS_MODEL ? `anthropic / ${RETRO_ANALYSIS_MODEL}` : `anthropic / ${RETRO_TRANSLATE_MODEL} + ${RETRO_ANALYSIS_MODEL}`;
  }
  if (provider === "gemini") return `gemini / ${GEMINI_MODEL}`;
  return "off";
}

function parseJsonText(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    // Only the length: the reply holds players' texts, which never go into a log.
    throw new Error(`The model returned invalid JSON (${cleaned.length} characters).`);
  }
}

let anthropic: Anthropic | null = null;
function anthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (see SETUP.md).");
  if (!anthropic) anthropic = new Anthropic({ apiKey });
  return anthropic;
}

async function viaAnthropic(request: GenerateJsonRequest): Promise<GenerateJsonResult> {
  const started = performance.now();
  const response = await anthropicClient().beta.messages.create({
    model: request.model,
    max_tokens: request.maxTokens ?? 16_000,
    ...fallbackOptions(request.model),
    system: request.system,
    output_config: {
      effort: request.effort ?? "medium",
      format: { type: "json_schema", schema: request.schema },
    },
    messages: [{ role: "user", content: request.prompt }],
  });
  log.debug("Anthropic request", { model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, elapsedMs: elapsedMs(started) });
  if (response.stop_reason === "refusal") throw new Error(`Claude declined this request (${response.stop_details?.category ?? "unknown category"}).`);
  if (response.stop_reason === "max_tokens") throw new Error("Claude's reply was cut off (max_tokens): the batch is too large.");
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) throw new Error("Claude returned an empty response.");
  return { data: parseJsonText(text), model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
}

let gemini: GoogleGenAI | null = null;
function geminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see SETUP.md).");
  if (!gemini) gemini = new GoogleGenAI({ apiKey });
  return gemini;
}

async function viaGemini(request: GenerateJsonRequest): Promise<GenerateJsonResult> {
  const started = performance.now();
  const response = await geminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: request.prompt,
    config: { systemInstruction: request.system, temperature: 0.2, responseMimeType: "application/json", responseJsonSchema: request.schema },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
  log.debug("Gemini request", { model: GEMINI_MODEL, inputTokens, outputTokens, elapsedMs: elapsedMs(started) });
  return { data: parseJsonText(text), model: GEMINI_MODEL, inputTokens, outputTokens };
}

export const generateJson: GenerateJson = async (request) => {
  const provider = translationProvider();
  if (provider === "anthropic") return withRetry(() => viaAnthropic(request));
  if (provider === "gemini") return withRetry(() => viaGemini(request));
  throw new Error("The AI step is turned off (set ANTHROPIC_API_KEY or GEMINI_API_KEY, or TRANSLATION_PROVIDER).");
};
