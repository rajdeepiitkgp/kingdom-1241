// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isTranslationConfigured, translationProvider, withRetry } from "@/lib/translate/provider";

describe("translation provider selection", () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.TRANSLATION_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("is off when no key is set", () => {
    expect(translationProvider()).toBe("off");
    expect(isTranslationConfigured()).toBe(false);
  });

  it("prefers Anthropic when its key is present, else Gemini", () => {
    process.env.GEMINI_API_KEY = "g";
    expect(translationProvider()).toBe("gemini");
    process.env.ANTHROPIC_API_KEY = "a";
    expect(translationProvider()).toBe("anthropic");
    expect(isTranslationConfigured()).toBe(true);
  });

  it("honours an explicit choice, including switching translation off", () => {
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.GEMINI_API_KEY = "g";
    process.env.TRANSLATION_PROVIDER = "gemini";
    expect(translationProvider()).toBe("gemini");
    process.env.TRANSLATION_PROVIDER = "off";
    expect(translationProvider()).toBe("off");
    expect(isTranslationConfigured()).toBe(false);
    // Explicit provider without its key → not configured (the CLI refuses, the webhook only revalidates).
    process.env.TRANSLATION_PROVIDER = "anthropic";
    delete process.env.ANTHROPIC_API_KEY;
    expect(isTranslationConfigured()).toBe(false);
  });
});

describe("withRetry", () => {
  it("retries rate limits and server errors, not bad requests", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw Object.assign(new Error("overloaded"), { status: 529 });
        return "ok";
      },
      4,
      1,
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);

    let badCalls = 0;
    await expect(
      withRetry(
        async () => {
          badCalls += 1;
          throw Object.assign(new Error("invalid request"), { status: 400 });
        },
        4,
        1,
      ),
    ).rejects.toThrow("invalid request");
    expect(badCalls).toBe(1);
  });

  it("does not mistake ordinary words in a message for a rate limit", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error("the players were frustrated about the separate rallies");
        },
        4,
        1,
      ),
    ).rejects.toThrow("frustrated");
    expect(calls).toBe(1);
  });
});
