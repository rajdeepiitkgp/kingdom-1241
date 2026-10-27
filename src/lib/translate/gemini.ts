// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { GoogleGenAI, Type } from "@google/genai";
import { parseTranslationJson } from "./parse";
import { buildPrompt, SYSTEM_INSTRUCTION, type TranslateFieldsOptions } from "./provider";

/**
 * Google Gemini translation provider (the free-tier option). Same contract as
 * the Anthropic one: a map of English fields in, the same keys translated out.
 * Selected with TRANSLATION_PROVIDER=gemini or when only GEMINI_API_KEY is set.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see SETUP.md).");
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export async function translateFields(
  fields: Record<string, string>,
  targetLocale: string,
  options: TranslateFieldsOptions = {},
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return {};

  const response = await getClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(fields, targetLocale, options),
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
  return parseTranslationJson(text, keys);
}
