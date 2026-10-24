import { createLogger } from "@/lib/log";
import { getLanguageInfo } from "@/lib/i18n/languages";
import { glossaryForPrompt } from "./glossary";

/**
 * Which AI service translates content. Chosen once per process:
 *
 *   TRANSLATION_PROVIDER=anthropic | gemini | off     explicit choice, or
 *   (unset)  → anthropic if ANTHROPIC_API_KEY is set, else gemini if
 *              GEMINI_API_KEY is set, else off.
 *
 * `off` keeps the site fully working: pages show English for anything not yet
 * translated, the webhook route only refreshes the cache, and the CLI says so.
 * Both providers get the same prompt and must return the same JSON shape, so
 * switching never changes the pipeline (`translate-row.ts`).
 */
export type TranslationProvider = "anthropic" | "gemini" | "off";

export interface TranslateFieldsOptions {
  /** Field names whose value is HTML (tags must be preserved). */
  htmlFields?: string[];
  /** Extra context for the model, e.g. "This is a kingdom rule." */
  context?: string;
}

export type TranslateFields = (
  fields: Record<string, string>,
  targetLocale: string,
  options?: TranslateFieldsOptions,
) => Promise<Record<string, string>>;

const log = createLogger("translate");

export function translationProvider(): TranslationProvider {
  const explicit = process.env.TRANSLATION_PROVIDER?.trim().toLowerCase();
  if (explicit === "anthropic" || explicit === "gemini" || explicit === "off") return explicit;
  if (explicit) log.warn("Unknown TRANSLATION_PROVIDER, falling back to auto-detection", { value: explicit });
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return "off";
}

/** True when a provider is selected and has its key. */
export function isTranslationConfigured(): boolean {
  const provider = translationProvider();
  if (provider === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY?.trim());
  return false;
}

/** Human-readable "provider / model" for logs and CLI output. */
export async function translationProviderLabel(): Promise<string> {
  const provider = translationProvider();
  if (provider === "anthropic") return `anthropic / ${(await import("./anthropic")).ANTHROPIC_MODEL}`;
  if (provider === "gemini") return `gemini / ${(await import("./gemini")).GEMINI_MODEL}`;
  return "off";
}

/** Translate `fields` (English) into `targetLocale` with the selected provider. */
export const translateFields: TranslateFields = async (fields, targetLocale, options = {}) => {
  const provider = translationProvider();
  if (provider === "anthropic") return (await import("./anthropic")).translateFields(fields, targetLocale, options);
  if (provider === "gemini") return (await import("./gemini")).translateFields(fields, targetLocale, options);
  throw new Error("Translation is turned off (set ANTHROPIC_API_KEY or GEMINI_API_KEY, or TRANSLATION_PROVIDER).");
};

// ---------------------------------------------------------------------------
// Prompt shared by both providers
// ---------------------------------------------------------------------------

export const SYSTEM_INSTRUCTION = `You are the translator for the community website of "Kingdom 1241", a kingdom (server) in the mobile strategy game Kingshot.
You translate interface text and player-written content (announcements, rules, event guides, battle plans) from English.

Rules:
- Translate naturally for players of the game; keep the tone friendly and clear. Use the informal register where the language distinguishes (German "du", etc.).
- Use the glossary for game terms. Keep terms marked "keep as is" untouched.
- Keep numbers, times (e.g. "12:00 UTC"), percentages, ratios like "1/10/89", alliance tags in brackets like [KvK] and [TMP], codes, URLs, emoji and placeholders in curly braces (e.g. {n} or {{date}}) exactly as they are.
- For HTML fields: translate only the human-readable text. Keep every tag, attribute, link and the structure exactly as in the source. Do not add or remove elements. Do not wrap the output in code fences.
- Do not add explanations or notes. Return only the translation of each field.
- If a field is empty, return an empty string for it.`;

/** The user turn: target language, context, glossary and the fields to translate. */
export function buildPrompt(fields: Record<string, string>, targetLocale: string, options: TranslateFieldsOptions): string {
  const keys = Object.keys(fields);
  const language = getLanguageInfo(targetLocale);
  const htmlFields = new Set(options.htmlFields ?? []);
  const fieldDescriptions = keys
    .map((key) => `### ${key}${htmlFields.has(key) ? " (HTML)" : ""}\n${fields[key] ?? ""}`)
    .join("\n\n");

  return `Target language: ${language.name} (${targetLocale})${language.direction === "rtl" ? " — a right-to-left language" : ""}.
${options.context ? `Context: ${options.context}\n` : ""}
Glossary:
${glossaryForPrompt(targetLocale)}

Translate each of the following fields from English into ${language.name}. Return a JSON object with exactly these keys: ${keys.map((k) => `"${k}"`).join(", ")}.

${fieldDescriptions}`;
}

/** Retry helper for rate limits and transient errors (both providers). */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4, baseDelayMs = 2000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const status = (error as { status?: number } | null)?.status;
      const retryable =
        status === 408 || status === 429 || (typeof status === "number" && status >= 500) ||
        /429|rate|quota|503|502|overloaded|timeout|ECONNRESET|fetch failed/i.test(message);
      if (!retryable || attempt === attempts - 1) throw error;
      const delay = baseDelayMs * 2 ** attempt;
      log.warn("Translation request failed, retrying", { attempt: attempt + 1, of: attempts, delayMs: delay, error: message.slice(0, 200) });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}
