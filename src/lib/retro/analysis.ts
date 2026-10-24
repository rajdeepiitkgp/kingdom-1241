import type { RetroResponse } from "@/lib/data/types";
import { type RatingKey, type RetroConfig, shownRatings, shownTexts, TEXT_KEYS, type TextKey } from "./questions";

/**
 * The AI step of the retrospective (pure, unit-tested): what is sent to the
 * model, the JSON shapes it must answer with, and how the answers are checked
 * before they are stored. The calls themselves live in ai.ts and analyse.ts.
 *
 * Two prompts: translating each response's texts to English (done once per
 * response, stored next to the original) and the summary over every response
 * (mood on the stars' 0–5 scale, positive/negative share per prompt, recurring
 * themes with a quote, three suggested actions). Only alliance, ratings and
 * texts go to the model: never a Governor ID or a name.
 */

export const ANALYSIS_VERSION = 1;
export const TRANSLATION_BATCH_SIZE = 25;
/** Hard ceiling on the text sent to the summary (characters); beyond it the oldest texts are left out, ratings stay. */
export const ANALYSIS_INPUT_MAX_CHARS = 900_000;

export interface PromptSentiment {
  positive: number;
  neutral: number;
  negative: number;
}

export interface Theme {
  prompt: TextKey;
  title: string;
  count: number;
  quote: string;
}

export interface AnalysisUsage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface RetroAnalysis {
  version: number;
  /** Overall mood on the same 0–5 scale as the stars. */
  mood: number;
  /** Two or three sentences for the council. */
  summary: string;
  /** Share of positive / neutral / negative answers per text prompt, in percent. */
  sentiment: Partial<Record<TextKey, PromptSentiment>>;
  themes: Theme[];
  actions: string[];
  model: string;
  usage: AnalysisUsage;
}

export type Texts = Record<TextKey, string>;

type TextSource = Pick<RetroResponse, "id" | "texts" | "textsEn" | "locale" | "allianceTag" | "ratings">;

export function hasText(r: Pick<RetroResponse, "texts">): boolean {
  return TEXT_KEYS.some((key) => r.texts[key]?.trim());
}

/** A response with text that has no English version yet. */
export function needsTranslation(r: Pick<RetroResponse, "texts" | "textsEn">): boolean {
  return hasText(r) && !r.textsEn;
}

/** The English texts when they exist, else the originals (the model copes with the few left untranslated). */
export function englishTexts(r: Pick<RetroResponse, "texts" | "textsEn">): Texts {
  const out = {} as Texts;
  for (const key of TEXT_KEYS) {
    const en = r.textsEn?.[key];
    out[key] = typeof en === "string" && en.trim() ? en : (r.texts[key] ?? "");
  }
  return out;
}

export function translationBatches<T extends Pick<RetroResponse, "texts" | "textsEn">>(responses: readonly T[], size = TRANSLATION_BATCH_SIZE): T[][] {
  const pending = responses.filter(needsTranslation);
  const out: T[][] = [];
  for (let i = 0; i < pending.length; i += size) out.push(pending.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Translation prompt
// ---------------------------------------------------------------------------

export const TRANSLATION_SYSTEM = `You translate short feedback texts written by players of the mobile strategy game Kingshot, members of "Kingdom 1241", into English for the kingdom's council.

Rules:
- Translate each text faithfully, in plain informal English; keep the tone (frustration stays frustration, jokes stay jokes).
- Keep game terms, player names, alliance tags in brackets like [KvK] or [TMP], numbers, times and emoji exactly as written.
- A text that is already English is returned unchanged, typos included. Mixed languages: translate the non-English parts.
- An empty text stays an empty string. Never add comments, labels or notes.
- Return only the JSON object you are asked for.`;

export function translationPrompt(batch: readonly Pick<RetroResponse, "id" | "texts" | "locale">[]): string {
  const items = batch.map((r) => ({ id: r.id, page_language: r.locale, ...Object.fromEntries(TEXT_KEYS.map((key) => [key, r.texts[key] ?? ""])) }));
  return `Translate the texts of every item into English. "page_language" is the language of the page the player used (a hint, not a guarantee). Answer with {"items": [...]} using the same ids, each item with the keys ${TEXT_KEYS.map((k) => `"${k}"`).join(", ")}.

${JSON.stringify(items, null, 1)}`;
}

/** JSON Schema of the translation reply: the same ids, one English string per text key. */
export function translationSchema(): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, ...Object.fromEntries(TEXT_KEYS.map((key) => [key, { type: "string" }])) },
          required: ["id", ...TEXT_KEYS],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  };
}

/**
 * The translations of a batch, by response id. An item that is missing, has
 * an unknown id, or returns an empty English text for a non-empty original is
 * dropped: that response is retried on the next run instead of being stored wrong.
 */
export function parseTranslationBatch(value: unknown, batch: readonly Pick<RetroResponse, "id" | "texts">[]): Map<string, Texts> {
  const out = new Map<string, Texts>();
  const items = value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items) ? ((value as { items: unknown[] }).items as unknown[]) : [];
  const originals = new Map(batch.map((r) => [r.id, r.texts]));
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const original = originals.get(id);
    if (!original || out.has(id)) continue;
    const texts = {} as Texts;
    let complete = true;
    for (const key of TEXT_KEYS) {
      const source = original[key]?.trim() ?? "";
      const en = typeof item[key] === "string" ? (item[key] as string).trim() : "";
      if (source && !en) {
        complete = false;
        break;
      }
      texts[key] = source ? en.slice(0, 1000) : "";
    }
    if (complete) out.set(id, texts);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Summary prompt
// ---------------------------------------------------------------------------

export const ANALYSIS_SYSTEM = `You are the analyst for the council of "Kingdom 1241", a kingdom (server) in the mobile strategy game Kingshot. After each battle (the internal castle battle or KvK, kingdom versus kingdom) players answer a short feedback form: star ratings from 0 (very poor) to 5 (excellent) and up to three short texts. [KvK] and [TMP] are the kingdom's two battle alliances; attackers rally, defenders garrison.

You receive every response, each with the player's alliance tag, their ratings and their texts (translated to English). Write for busy council members who will act on it:
- "mood": one number from 0 to 5 that summarises how the players feel overall, consistent with both the ratings and the texts.
- "summary": two or three plain sentences: how it went, the one or two things that mattered most, how the alliances differ if they clearly do.
- "sentiment": for each text prompt, the share of answers that are mostly positive, neutral or negative, in percent, adding up to 100 (0/0/0 when nobody wrote anything for it).
- "themes": the recurring points, most frequent first, at most ten in total: which prompt they come from, a title of a few words, how many responses raise them, and one short quote (under 160 characters, verbatim from a response, no names). A point raised once is not a theme.
- "actions": exactly three concrete, specific things the council should do before the next battle, derived from the themes, each one sentence.
Be concrete, never flattering. If responses contradict each other, say so in the summary. Never invent counts. Return only the JSON object.`;

export interface AnalysisContext {
  title: string;
  eventType: string;
  battleAt: string | null;
  ratingLabels: Partial<Record<RatingKey, string>>;
  textLabels: Partial<Record<TextKey, string>>;
}

function responseLine(index: number, r: TextSource, ratingKeys: readonly RatingKey[], textKeys: readonly TextKey[], texts: Texts): string {
  const ratings = ratingKeys.map((key) => `${key}=${typeof r.ratings[key] === "number" ? r.ratings[key] : "-"}`).join(" ");
  const parts = textKeys.filter((key) => texts[key]?.trim()).map((key) => `${key}: ${texts[key].replace(/\s+/g, " ").trim()}`);
  return `#${index} [${r.allianceTag ?? "none"}] ${ratings}${parts.length > 0 ? ` | ${parts.join(" | ")}` : ""}`;
}

export interface AnalysisInput {
  prompt: string;
  /** Responses whose texts were left out to stay within the budget (their ratings are still in). */
  omittedTexts: number;
}

/** The user turn of the summary request. Newest responses first so a budget cut drops the oldest texts. */
export function analysisPrompt(responses: readonly TextSource[], config: RetroConfig, context: AnalysisContext, maxChars = ANALYSIS_INPUT_MAX_CHARS): AnalysisInput {
  const ratingKeys = shownRatings(config).map((q) => q.key);
  const textKeys = shownTexts(config).map((t) => t.key);
  const header = [
    `Battle: ${context.title} (${context.eventType === "kvk" ? "KvK" : "internal castle battle"}${context.battleAt ? `, ${context.battleAt.slice(0, 10)}` : ""}).`,
    `Rating questions (0–5): ${ratingKeys.map((key) => `${key} = ${context.ratingLabels[key] ?? key}`).join("; ")}.`,
    `Text prompts: ${textKeys.map((key) => `${key} = ${context.textLabels[key] ?? key}`).join("; ")}.`,
    `${responses.length} responses, one per line: #number [alliance] ratings | texts.`,
  ].join("\n");

  const lines: string[] = [];
  let used = header.length;
  let omittedTexts = 0;
  responses.forEach((r, i) => {
    const full = responseLine(i + 1, r, ratingKeys, textKeys, englishTexts(r));
    if (used + full.length <= maxChars) {
      lines.push(full);
      used += full.length + 1;
    } else {
      const bare = responseLine(i + 1, r, ratingKeys, [], englishTexts(r));
      if (hasText(r)) omittedTexts += 1;
      lines.push(bare);
      used += bare.length + 1;
    }
  });
  const note = omittedTexts > 0 ? `\n(${omittedTexts} older responses are listed with ratings only to fit the request.)` : "";
  return { prompt: `${header}${note}\n\n${lines.join("\n")}`, omittedTexts };
}

/** JSON Schema of the summary reply; the sentiment keys follow the prompts shown in this retrospective. */
export function analysisSchema(textKeys: readonly TextKey[]): Record<string, unknown> {
  const sentiment = {
    type: "object",
    properties: { positive: { type: "number" }, neutral: { type: "number" }, negative: { type: "number" } },
    required: ["positive", "neutral", "negative"],
    additionalProperties: false,
  };
  return {
    type: "object",
    properties: {
      mood: { type: "number" },
      summary: { type: "string" },
      sentiment: {
        type: "object",
        properties: Object.fromEntries(textKeys.map((key) => [key, sentiment])),
        required: [...textKeys],
        additionalProperties: false,
      },
      themes: {
        type: "array",
        items: {
          type: "object",
          properties: { prompt: { type: "string", enum: [...textKeys] }, title: { type: "string" }, count: { type: "integer" }, quote: { type: "string" } },
          required: ["prompt", "title", "count", "quote"],
          additionalProperties: false,
        },
      },
      actions: { type: "array", items: { type: "string" } },
    },
    required: ["mood", "summary", "sentiment", "themes", "actions"],
    additionalProperties: false,
  };
}

function clamp(n: unknown, min: number, max: number): number | null {
  const v = typeof n === "number" && Number.isFinite(n) ? n : typeof n === "string" ? Number(n) : Number.NaN;
  if (!Number.isFinite(v)) return null;
  return Math.min(max, Math.max(min, v));
}

/** The model's reply as a stored analysis, or null when it is unusable (then nothing is written). */
export function parseAnalysis(value: unknown, textKeys: readonly TextKey[], meta: { model: string; usage: AnalysisUsage }): RetroAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const mood = clamp(v.mood, 0, 5);
  const summary = typeof v.summary === "string" ? v.summary.trim().slice(0, 2000) : "";
  if (mood === null || !summary) return null;

  const sentiment: Partial<Record<TextKey, PromptSentiment>> = {};
  const rawSentiment = v.sentiment && typeof v.sentiment === "object" ? (v.sentiment as Record<string, unknown>) : {};
  for (const key of textKeys) {
    const s = rawSentiment[key] && typeof rawSentiment[key] === "object" ? (rawSentiment[key] as Record<string, unknown>) : null;
    const positive = clamp(s?.positive, 0, 100) ?? 0;
    const neutral = clamp(s?.neutral, 0, 100) ?? 0;
    const negative = clamp(s?.negative, 0, 100) ?? 0;
    const total = positive + neutral + negative;
    sentiment[key] =
      total > 0
        ? { positive: Math.round((positive / total) * 100), neutral: Math.round((neutral / total) * 100), negative: Math.round((negative / total) * 100) }
        : { positive: 0, neutral: 0, negative: 0 };
  }

  const themes: Theme[] = [];
  for (const raw of Array.isArray(v.themes) ? v.themes : []) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const prompt = typeof t.prompt === "string" && (textKeys as readonly string[]).includes(t.prompt) ? (t.prompt as TextKey) : null;
    const title = typeof t.title === "string" ? t.title.trim().slice(0, 120) : "";
    const count = clamp(t.count, 1, 100_000);
    if (!prompt || !title || count === null) continue;
    themes.push({ prompt, title, count: Math.round(count), quote: typeof t.quote === "string" ? t.quote.trim().slice(0, 240) : "" });
    if (themes.length === 10) break;
  }
  themes.sort((a, b) => b.count - a.count);

  const actions = (Array.isArray(v.actions) ? v.actions : [])
    .filter((a): a is string => typeof a === "string" && a.trim() !== "")
    .map((a) => a.trim().slice(0, 300))
    .slice(0, 5);

  return { version: ANALYSIS_VERSION, mood, summary, sentiment, themes, actions, model: meta.model, usage: meta.usage };
}

/** The stored JSON as an analysis (tolerant: an older or damaged value is treated as absent). */
export function readStoredAnalysis(value: unknown): RetroAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const model = typeof v.model === "string" ? v.model : "";
  const u = v.usage && typeof v.usage === "object" ? (v.usage as Record<string, unknown>) : {};
  const usage: AnalysisUsage = {
    requests: clamp(u.requests, 0, 1e9) ?? 0,
    inputTokens: clamp(u.inputTokens, 0, 1e12) ?? 0,
    outputTokens: clamp(u.outputTokens, 0, 1e12) ?? 0,
  };
  return parseAnalysis(v, TEXT_KEYS, { model, usage });
}
