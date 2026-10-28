// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fallbackOptions } from "@/lib/translate/anthropic";

const MODEL_VARS = ["ANTHROPIC_MODEL", "RETRO_TRANSLATE_MODEL", "RETRO_ANALYSIS_MODEL"];

/** The model constants are read once at import, so each case imports fresh copies. */
async function models() {
  vi.resetModules();
  const { ANTHROPIC_MODEL } = await import("@/lib/translate/anthropic");
  const { RETRO_TRANSLATE_MODEL, RETRO_ANALYSIS_MODEL } = await import("@/lib/retro/ai");
  return [ANTHROPIC_MODEL, RETRO_TRANSLATE_MODEL, RETRO_ANALYSIS_MODEL];
}

describe("Claude models", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Claude Haiku for every AI job unless a variable says otherwise (the owner's choice: the larger models ran up the bill)", async () => {
    for (const name of MODEL_VARS) vi.stubEnv(name, " ");
    expect(await models()).toEqual(["claude-haiku-5-5", "claude-haiku-5-5", "claude-haiku-5-5"]);
  });

  it("still lets each variable pick another model", async () => {
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
    vi.stubEnv("RETRO_TRANSLATE_MODEL", "");
    vi.stubEnv("RETRO_ANALYSIS_MODEL", " claude-opus-5-5 ");
    expect(await models()).toEqual(["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"]);
  });

  it("asks for the server-side fallback only on models that have one", () => {
    expect(fallbackOptions("claude-haiku-5-5")).toEqual({});
    expect(fallbackOptions("claude-opus-5-5")).toEqual({ betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  });
});
