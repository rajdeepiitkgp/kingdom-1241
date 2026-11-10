// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import type { Tour } from "@/lib/tour/tour";
import { KVK_CHECKLIST_TOUR } from "./checklist";
import { KVK_FEEDBACK_TOUR } from "./feedback";
import { KVK_LEADERS_TOUR } from "./leaders";
import { KVK_MINISTRY_TOUR } from "./ministry";
import { KVK_PLAN_TOUR } from "./plan";
import { KVK_PREP_TOUR } from "./prep";

/** All KvK tours together, for the tests; a page imports its own tour's file. */
export const KVK_TOURS = {
  plan: KVK_PLAN_TOUR,
  leaders: KVK_LEADERS_TOUR,
  checklist: KVK_CHECKLIST_TOUR,
  prep: KVK_PREP_TOUR,
  ministry: KVK_MINISTRY_TOUR,
  feedback: KVK_FEEDBACK_TOUR,
} satisfies Record<string, Tour<UiKey>>;
