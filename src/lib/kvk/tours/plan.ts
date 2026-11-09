// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";
import { header, lock } from "./shared";

/** The battle plan (/kvk). */
export const KVK_PLAN_TOUR: Tour<UiKey> = {
  id: "kvk-plan",
  version: 1,
  steps: [
    uiStep("kvk-unlock", "kvk.unlock"),
    uiStep("kvk-tabs", "kvk.tabs"),
    header,
    uiStep("kvk-feedback", "kvk.feedback"),
    uiStep("kvk-rules", "kvk.rules"),
    uiStep("kvk-coordinators", "kvk.coordinators"),
    uiStep("kvk-formations", "kvk.formations"),
    lock,
  ],
};
