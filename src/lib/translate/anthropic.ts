import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@/lib/log";
import { parseTranslationJson, translationSchema } from "./parse";
import { buildPrompt, SYSTEM_INSTRUCTION, type TranslateFieldsOptions } from "./provider";

/**
 * Anthropic (Claude) translation provider. Same contract as the Gemini one:
 * a map of English fields in, the same keys translated out.
 *
 * - Structured output (`output_config.format`) guarantees the JSON shape.
 * - Low effort: translation doesn't need deep reasoning; keeps latency and cost down.
 * - `fallbacks: "default"`: if a safety classifier declines a request, the API
 *   re-runs it on Anthropic's recommended fallback model instead of failing.
 * - Token usage is accumulated so the CLI can print what a run cost.
 */

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";

const log = createLogger("anthropic");

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (see SETUP.md).");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

const usage = { requests: 0, inputTokens: 0, outputTokens: 0 };

/** Tokens used by this process so far (for the CLI summary). */
export function getAnthropicUsage() {
  return { ...usage };
}

export async function translateFields(
  fields: Record<string, string>,
  targetLocale: string,
  options: TranslateFieldsOptions = {},
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return {};

  const started = performance.now();
  const response = await getClient().beta.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_INSTRUCTION,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: translationSchema(keys) },
    },
    messages: [{ role: "user", content: buildPrompt(fields, targetLocale, options) }],
  });

  usage.requests += 1;
  usage.inputTokens += response.usage.input_tokens;
  usage.outputTokens += response.usage.output_tokens;
  log.debug("Translated a batch", {
    model: response.model,
    locale: targetLocale,
    fields: keys.length,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    ms: Math.round(performance.now() - started),
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined to translate this batch (${response.stop_details?.category ?? "unknown category"}).`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude's reply was cut off (max_tokens) — the batch is too large.");
  }

  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) throw new Error("Claude returned an empty response.");
  return parseTranslationJson(text, keys);
}
