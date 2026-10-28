// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import { type Tour, uiStep } from "./tour";

/**
 * The Home page's guided tour: where things are on the site and the parts of
 * Home that are real today. Announcements, events and gift codes are still
 * placeholder content, so the tour leaves them out until they are filled in.
 */
export const HOME_TOUR: Tour<UiKey> = {
  id: "home",
  version: 1,
  steps: [
    uiStep("site-nav", "site.nav"),
    uiStep("site-language", "site.language"),
    uiStep("site-text", "site.text"),
    uiStep("site-theme", "site.theme"),
    uiStep("home-clock", "home.clock"),
    uiStep("home-prep", "home.prep"),
    uiStep("home-kvk", "home.kvk"),
    uiStep("home-alliances", "home.alliances"),
  ],
};
