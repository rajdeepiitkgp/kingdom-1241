// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";
import { lock } from "./shared";

/** The prep days (/kvk/prep): a public page; the council's buff days (and Lock page) show with the battle plan's cookie, a row with the password button without it. */
export const KVK_PREP_TOUR: Tour<UiKey> = {
  id: "kvk-prep",
  version: 2,
  steps: [
    uiStep("prep-status", "prep.status"),
    uiStep("prep-council", "prep.council", "prep.council.title"),
    lock,
    uiStep("prep-unlock", "prep.unlock", "prep.council.title"),
    uiStep("prep-days", "prep.days"),
    uiStep("prep-day", "prep.day"),
    uiStep("prep-table", "prep.table", "prep.tableTitle"),
    uiStep("prep-save", "prep.save", "prep.saveTitle"),
  ],
};
