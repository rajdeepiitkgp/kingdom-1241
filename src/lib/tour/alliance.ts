// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "./tour";

/**
 * An alliance page's guided tour. A step whose part the alliance hasn't
 * filled in (no description, no Discord link, no guide sections) has no
 * marker on the page and is left out when the tour starts.
 */
export const ALLIANCE_TOUR: Tour<UiKey> = {
  id: "alliance",
  version: 1,
  steps: [
    uiStep("alliance-stats", "alliance.stats"),
    uiStep("alliance-about", "alliance.about", "alliance.about"),
    uiStep("alliance-discord", "alliance.discord"),
    uiStep("alliance-guides", "alliance.guides"),
  ],
};
