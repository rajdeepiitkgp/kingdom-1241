// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";
import { header, lock } from "./shared";

/** The commander checklist (/kvk/checklist). */
export const KVK_CHECKLIST_TOUR: Tour<UiKey> = {
  id: "kvk-checklist",
  version: 1,
  steps: [
    uiStep("kvk-unlock", "checklist.unlock"),
    header,
    uiStep("checklist-board", "checklist.board"),
    uiStep("checklist-orders", "checklist.orders", "checklist.commander"),
    uiStep("checklist-guidelines", "checklist.guidelines", "checklist.guidelines"),
    lock,
  ],
};
