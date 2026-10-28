import { describe, expect, it } from "vitest";
import { DEFAULT_FEEDBACK_DEFAULTS, parseFeedbackDefaults } from "@/lib/retro/form-defaults";
import { DEFAULT_MAX_RESPONSES, DEFAULT_RETENTION_DAYS, MAX_RESPONSES_LIMIT, RETENTION_RANGE } from "@/lib/retro/questions";

describe("the owner's defaults for new feedback forms", () => {
  it("start from the form's own defaults and stay within what the database accepts", () => {
    expect(DEFAULT_FEEDBACK_DEFAULTS).toEqual({ retentionDays: DEFAULT_RETENTION_DAYS, maxResponses: DEFAULT_MAX_RESPONSES });
    expect(parseFeedbackDefaults({ retentionDays: 1, maxResponses: 99_999 })).toEqual({ retentionDays: RETENTION_RANGE.min, maxResponses: MAX_RESPONSES_LIMIT });
  });
});
