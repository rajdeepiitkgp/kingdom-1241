// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";

/** The battle feedback form (/kvk/feedback). */
export const KVK_FEEDBACK_TOUR: Tour<UiKey> = {
  id: "kvk-feedback",
  version: 1,
  steps: [
    uiStep("kvk-unlock", "feedback.unlock"),
    uiStep("kvk-tabs", "kvk.tabs"),
    uiStep("retro-header", "feedback.header"),
    uiStep("retro-done", "feedback.done"),
    uiStep("retro-closed", "feedback.closed"),
    uiStep("retro-you", "feedback.you", "retro.you"),
    uiStep("retro-ratings", "feedback.ratings"),
    uiStep("retro-texts", "feedback.texts", "retro.texts"),
    uiStep("retro-send", "feedback.send"),
  ],
};
