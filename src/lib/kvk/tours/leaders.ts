// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";
import { header, lock } from "./shared";

/** The rally-leader plan (/kvk/leaders). */
export const KVK_LEADERS_TOUR: Tour<UiKey> = {
  id: "kvk-leaders",
  version: 1,
  steps: [uiStep("kvk-unlock", "leaders.unlock"), header, uiStep("leaders-rules", "leaders.rules"), uiStep("leaders-glance", "leaders.glance", "leaders.glance"), uiStep("leaders-rallies", "leaders.rallies"), lock],
};
