// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Shared by every translation provider: turn the model's JSON reply into the
 * `{ fieldKey: translatedText }` map we asked for. Tolerant of code fences and
 * missing keys (a missing key is returned as "" and left untranslated by the
 * pipeline, which retries the row on the next run).
 */
export function parseTranslationJson(text: string, keys: string[]): Record<string, string> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Only the length: the reply is translated content, which never goes into a log.
    throw new Error(`Translation model returned invalid JSON (${cleaned.length} characters).`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Translation model returned a non-object response.");
  }
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = (parsed as Record<string, unknown>)[key];
    result[key] = typeof value === "string" ? value.trim() : "";
  }
  return result;
}

/** JSON Schema for the reply: one string per field key, nothing else. */
export function translationSchema(keys: string[]) {
  return {
    type: "object",
    properties: Object.fromEntries(keys.map((key) => [key, { type: "string" }])),
    required: keys,
    additionalProperties: false,
  } as const;
}
