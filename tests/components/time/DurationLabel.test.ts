import { describe, expect, it } from "vitest";
import { formatDuration } from "@/components/time/DurationLabel";
import { UI_STRINGS } from "@/content/seed/ui-strings";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { DAY, HOUR, MINUTE } from "@/lib/time";

function dictionary(lang: "en" | "de" | "ar"): Dictionary {
  return Object.fromEntries(Object.entries(UI_STRINGS).map(([key, text]) => [key, text[lang]])) as Dictionary;
}

describe("formatDuration", () => {
  const en = dictionary("en");

  it("spells out the units, with seconds only under a day", () => {
    expect(formatDuration(2 * DAY + 5 * HOUR + 13 * MINUTE + 9_000, en)).toBe("2 days 5 hrs 13 min");
    expect(formatDuration(5 * HOUR + 13 * MINUTE + 9_000, en)).toBe("5 hrs 13 min 09 sec");
    expect(formatDuration(13 * MINUTE + 9_000, en)).toBe("13 min 09 sec");
  });

  it("formats a clock, with a translated day unit instead of the first letter of 'days'", () => {
    expect(formatDuration(HOUR - 2_000, en, true)).toBe("00:59:58");
    expect(formatDuration(2 * DAY + 5 * HOUR + 13 * MINUTE + 9_000, en, true)).toBe("2d 05:13:09");
    expect(formatDuration(DAY, dictionary("de"), true)).toBe("1T 00:00:00");
    expect(formatDuration(DAY, dictionary("ar"), true)).toBe("1ي 00:00:00");
  });

  it("never goes negative", () => {
    expect(formatDuration(-5_000, en, true)).toBe("00:00:00");
  });
});
