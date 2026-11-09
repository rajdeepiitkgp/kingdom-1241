import { describe, expect, it } from "vitest";
import { DEFAULT_SHOWN_RATINGS, RATING_KEYS, TEXT_KEYS } from "@/lib/retro/config";
import { RATING_QUESTIONS, TEXT_PROMPTS } from "@/lib/retro/questions";

describe("the question catalogue and the config rules", () => {
  it("list every rating and text key once, in the same order", () => {
    expect(RATING_QUESTIONS.map((q) => q.key)).toEqual([...RATING_KEYS]);
    expect(TEXT_PROMPTS.map((t) => t.key)).toEqual([...TEXT_KEYS]);
  });

  it("agree on which ratings a new retrospective shows", () => {
    expect(RATING_QUESTIONS.filter((q) => q.defaultShown).map((q) => q.key)).toEqual([...DEFAULT_SHOWN_RATINGS]);
  });
});

describe("shown keys", () => {
  it("follow the config in form order", async () => {
    const { defaultConfig, shownRatingKeys, shownTextKeys } = await import("@/lib/retro/config");
    const config = defaultConfig();
    expect(shownRatingKeys(config)).toEqual(["overall", "planning", "coordination", "formations"]);
    config.ratings.overall.shown = false;
    config.ratings.teamwork.shown = true;
    expect(shownRatingKeys(config)).toEqual(["planning", "coordination", "formations", "teamwork"]);
    config.texts.went_wrong.shown = false;
    expect(shownTextKeys(config)).toEqual(["went_well", "suggestions"]);
  });
});
