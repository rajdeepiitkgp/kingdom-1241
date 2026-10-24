import { describe, expect, it } from "vitest";
import { UI_STRINGS } from "@/content/seed/ui-strings";
import {
  configFieldName,
  configFromForm,
  configProblem,
  defaultConfig,
  parseConfig,
  RATING_QUESTIONS,
  shownRatings,
  shownTexts,
  TEXT_PROMPTS,
} from "@/lib/retro/questions";

describe("question catalogue", () => {
  it("has a translated label and hint for every question and prompt", () => {
    for (const q of [...RATING_QUESTIONS, ...TEXT_PROMPTS]) {
      expect(UI_STRINGS[q.labelKey].en, q.key).toBeTruthy();
      expect(UI_STRINGS[q.hintKey].en, q.key).toBeTruthy();
    }
    expect(new Set(RATING_QUESTIONS.map((q) => q.key)).size).toBe(RATING_QUESTIONS.length);
  });

  it("shows four required ratings and three optional texts by default", () => {
    const config = defaultConfig();
    expect(shownRatings(config).map((q) => q.key)).toEqual(["overall", "planning", "coordination", "formations"]);
    expect(shownRatings(config).every((q) => config.ratings[q.key].required)).toBe(true);
    expect(shownTexts(config)).toHaveLength(3);
    expect(Object.values(config.texts).every((t) => !t.required)).toBe(true);
  });
});

describe("parseConfig", () => {
  it("fills gaps with defaults and drops unknown keys", () => {
    const config = parseConfig({ ratings: { overall: { shown: false }, bogus: { shown: true } }, texts: { suggestions: { shown: true, required: true } } });
    expect(config.ratings.overall).toEqual({ shown: false, required: false });
    expect(config.ratings.planning).toEqual({ shown: true, required: true });
    expect(config.texts.suggestions).toEqual({ shown: true, required: true });
    expect("bogus" in config.ratings).toBe(false);
  });

  it("never requires a hidden question and survives garbage", () => {
    expect(parseConfig({ ratings: { timing: { shown: false, required: true } } }).ratings.timing).toEqual({ shown: false, required: false });
    expect(parseConfig(null)).toEqual(defaultConfig());
    expect(parseConfig("x")).toEqual(defaultConfig());
  });
});

describe("configFromForm", () => {
  it("reads the editor's checkboxes", () => {
    const fd = new FormData();
    fd.set(configFieldName("rating", "overall", "shown"), "on");
    fd.set(configFieldName("rating", "overall", "required"), "on");
    fd.set(configFieldName("rating", "timing", "required"), "on"); // not shown → not required
    fd.set(configFieldName("text", "suggestions", "shown"), "on");
    const config = configFromForm(fd);
    expect(config.ratings.overall).toEqual({ shown: true, required: true });
    expect(config.ratings.timing).toEqual({ shown: false, required: false });
    expect(config.ratings.planning.shown).toBe(false);
    expect(config.texts.suggestions).toEqual({ shown: true, required: false });
    expect(config.texts.went_well.shown).toBe(false);
    expect(configProblem(config)).toBeNull();
  });

  it("refuses a form with nothing to answer", () => {
    expect(configProblem(configFromForm(new FormData()))).toMatch(/at least one/);
  });
});
