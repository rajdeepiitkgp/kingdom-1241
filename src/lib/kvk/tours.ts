// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "@/lib/tour/tour";

/**
 * The guided tours of the KvK pages, opened from "Guided tour" in each page's
 * header. A locked page shows only its password card, so its tour is the
 * password step; once unlocked, the same tour walks through the content
 * (steps whose part isn't on the page are left out).
 */

const header = uiStep("kvk-header", "kvk.header");
const lock = uiStep("kvk-lock", "kvk.lock");

export const KVK_TOURS = {
  plan: {
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
  },
  leaders: {
    id: "kvk-leaders",
    version: 1,
    steps: [uiStep("kvk-unlock", "leaders.unlock"), header, uiStep("leaders-rules", "leaders.rules"), uiStep("leaders-glance", "leaders.glance"), uiStep("leaders-rallies", "leaders.rallies"), lock],
  },
  checklist: {
    id: "kvk-checklist",
    version: 1,
    steps: [
      uiStep("kvk-unlock", "checklist.unlock"),
      header,
      uiStep("checklist-board", "checklist.board"),
      uiStep("checklist-orders", "checklist.orders"),
      uiStep("checklist-guidelines", "checklist.guidelines"),
      lock,
    ],
  },
  prep: {
    id: "kvk-prep",
    version: 1,
    steps: [uiStep("prep-status", "prep.status"), uiStep("prep-days", "prep.days"), uiStep("prep-day", "prep.day"), uiStep("prep-table", "prep.table"), uiStep("prep-save", "prep.save")],
  },
  feedback: {
    id: "kvk-feedback",
    version: 1,
    steps: [
      uiStep("kvk-unlock", "feedback.unlock"),
      uiStep("kvk-tabs", "kvk.tabs"),
      uiStep("retro-header", "feedback.header"),
      uiStep("retro-done", "feedback.done"),
      uiStep("retro-closed", "feedback.closed"),
      uiStep("retro-you", "feedback.you"),
      uiStep("retro-ratings", "feedback.ratings"),
      uiStep("retro-texts", "feedback.texts"),
      uiStep("retro-send", "feedback.send"),
    ],
  },
} satisfies Record<string, Tour<UiKey>>;
