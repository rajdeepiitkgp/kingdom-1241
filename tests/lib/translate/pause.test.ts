import { describe, expect, it } from "vitest";
import { parseTranslationSettings, TRANSLATION_RUNNING } from "@/lib/translate/pause";

describe("the machine translation pause", () => {
  it("is off unless the stored value says paused", () => {
    expect(parseTranslationSettings(null)).toEqual(TRANSLATION_RUNNING);
    expect(parseTranslationSettings({ paused: "yes" })).toEqual(TRANSLATION_RUNNING);
    expect(parseTranslationSettings({ paused: true, since: "2026-10-28T15:00:00.000Z" })).toEqual({ paused: true, since: "2026-10-28T15:00:00.000Z" });
    expect(parseTranslationSettings({ paused: true })).toEqual({ paused: true, since: null });
  });
});
