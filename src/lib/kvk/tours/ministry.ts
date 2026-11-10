// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";
import { lock } from "./shared";

/** The ministry sign-ups (/kvk/ministry), behind the battle plan's password: locked, the tour is the password step; unlocked, it walks through the round and the form. */
export const KVK_MINISTRY_TOUR: Tour<UiKey> = {
  id: "kvk-ministry",
  version: 1,
  steps: [
    uiStep("kvk-unlock", "kvk.unlock"),
    uiStep("ministry-round", "ministry.round"),
    lock,
    uiStep("ministry-mine", "ministry.mine", "ministry.mine.title"),
    uiStep("ministry-you", "ministry.you", "ministry.you"),
    uiStep("ministry-day", "ministry.day"),
    uiStep("ministry-slots", "ministry.slots", "ministry.slots.title"),
    uiStep("ministry-send", "ministry.send", "ministry.submit"),
  ],
};
