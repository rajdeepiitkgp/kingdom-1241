import { GoogleGenAI, Type } from "@google/genai";
import { getLanguageInfo } from "@/lib/i18n/languages";
import { createLogger } from "@/lib/log";
import { glossaryForPrompt } from "./glossary";

const log = createLogger("gemini");

/**
 * Thin wrapper around the Gemini API for translating a set of named fields
 * from English into one target language in a single request.
 *
 * Only ever called by the translation pipeline (webhook route + CLI script),
 * never while rendering a page.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see SETUP.md).");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export interface TranslateFieldsOptions {
  /** Field names whose value is HTML (tags must be preserved). */
  htmlFields?: string[];
  /** Extra context for the model, e.g. "This is a kingdom rule." */
  context?: string;
}

const SYSTEM_INSTRUCTION = `You are the translator for the community website of "Kingdom 1241", a kingdom (server) in the mobile strategy game Kingshot.
You translate interface text and player-written content (announcements, rules, event guides) from English.

Rules:
- Translate naturally for players of the game; keep the tone friendly and clear. Use the informal register where the language distinguishes (German "du", etc.).
- Use the glossary for game terms. Keep terms marked "keep as is" untouched.
- Keep numbers, times (e.g. "12:00 UTC"), percentages, ratios like "1/10/89", codes, URLs, emoji and placeholders in curly braces (e.g. {n}) exactly as they are.
- For HTML fields: translate only the human-readable text. Keep every tag, attribute, link and the structure exactly as in the source. Do not add or remove elements. Do not wrap the output in code fences.
- Do not add explanations or notes. Return only the translation of each field.
- If a field is empty, return an empty string for it.`;

/**
 * Translate `fields` (English) into `targetLocale`. Returns the same keys.
 * Throws on API errors so the caller can decide whether to retry.
 */
export async function translateFields(
  fields: Record<string, string>,
  targetLocale: string,
  options: TranslateFieldsOptions = {},
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return {};

  const language = getLanguageInfo(targetLocale);
  const htmlFields = new Set(options.htmlFields ?? []);

  const fieldDescriptions = keys
    .map((key) => `### ${key}${htmlFields.has(key) ? " (HTML)" : ""}\n${fields[key] ?? ""}`)
    .join("\n\n");

  const prompt = `Target language: ${language.name} (${targetLocale})${language.direction === "rtl" ? " — a right-to-left language" : ""}.
${options.context ? `Context: ${options.context}\n` : ""}
Glossary:
${glossaryForPrompt(targetLocale)}

Translate each of the following fields from English into ${language.name}. Return a JSON object with exactly these keys: ${keys.map((k) => `"${k}"`).join(", ")}.

${fieldDescriptions}`;

  const response = await getClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: Object.fromEntries(keys.map((key) => [key, { type: Type.STRING }])),
        required: keys,
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Gemini returned a non-object response.");

  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = (parsed as Record<string, unknown>)[key];
    result[key] = typeof value === "string" ? value.trim() : "";
  }
  return result;
}

/** Retry helper for rate limits (free tier) and transient errors. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseDelayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /429|rate|quota|503|502|overloaded|timeout|ECONNRESET|fetch failed/i.test(message);
      if (!retryable || attempt === attempts - 1) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      log.warn("Gemini request failed, retrying", { attempt: attempt + 1, of: attempts, delayMs: delay, error: message.slice(0, 200) });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
