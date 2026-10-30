// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { OBJECT: "OBJECT", STRING: "STRING" },
}));

describe("Gemini provider", () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContent.mockReset();
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("asks for every field as a JSON object with exactly those keys and returns the parsed answer", async () => {
    const { GEMINI_MODEL, translateFields } = await import("@/lib/translate/gemini");
    generateContent.mockResolvedValue({ text: JSON.stringify({ title: "Hallo", body: "Welt" }) });
    const result = await translateFields({ title: "Hello", body: "World" }, "de");
    expect(result).toEqual({ title: "Hallo", body: "Welt" });
    const call = generateContent.mock.calls[0][0] as { model: string; contents: string; config: { responseSchema: { required: string[] }; responseMimeType: string } };
    expect(call.model).toBe(GEMINI_MODEL);
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.responseSchema.required).toEqual(["title", "body"]);
    expect(call.contents).toContain("Hello");
  });

  it("answers an empty map without a request and refuses an empty response", async () => {
    const { translateFields } = await import("@/lib/translate/gemini");
    expect(await translateFields({}, "de")).toEqual({});
    expect(generateContent).not.toHaveBeenCalled();
    generateContent.mockResolvedValue({ text: "" });
    await expect(translateFields({ title: "Hello" }, "de")).rejects.toThrow(/empty response/);
  });
});
