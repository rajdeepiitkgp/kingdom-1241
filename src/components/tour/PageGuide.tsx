// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import type { UiKey } from "@/content/seed/ui-strings";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { resolveSteps, type Tour } from "@/lib/tour/tour";
import { tourLabels, useGuidedTour } from "./GuidedTour";

/**
 * A public page's guided tour, for a flex-wrap row such as the PageHeader's
 * title row: the "?" (labelled from tablet width up) goes to the row's end,
 * the "New here?" line to a row of its own below it.
 */
export function PageGuide({ tour, dict }: { tour: Tour<UiKey>; dict: Dictionary }) {
  const guide = useGuidedTour(tour, resolveSteps(tour, dict), tourLabels(dict), { showLabel: "wide" });
  return (
    <>
      <span className="ms-auto inline-flex">{guide.button}</span>
      {guide.nudge && <div className="order-last basis-full">{guide.nudge}</div>}
      {guide.overlay}
    </>
  );
}
