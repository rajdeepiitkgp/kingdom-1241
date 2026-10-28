// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { usePathname } from "next/navigation";
import { ADMIN_TOUR_LABELS, ADMIN_TOURS, adminPageFor } from "@/lib/admin/tours";
import { useGuidedTour } from "../tour/GuidedTour";

const NO_TOUR = { id: "admin-none", version: 1, steps: [] };

/**
 * "Page guide" in the admin bar: the guided tour of whichever admin page is
 * open. Its "New here?" line takes the bar's last row until this device has
 * opened or hidden that page's guide. Reads the path, so it sits behind a
 * Suspense boundary in AdminShell.
 */
export function AdminGuide() {
  const page = adminPageFor(usePathname());
  const tour = page ? ADMIN_TOURS[page] : NO_TOUR;
  const guide = useGuidedTour(tour, tour.steps, ADMIN_TOUR_LABELS, { showLabel: true, dir: "ltr", lang: "en" });
  if (!page) return null;
  return (
    <>
      <span className="inline-flex" data-tour="admin-guide">
        {guide.button}
      </span>
      {guide.nudge && <div className="order-last basis-full">{guide.nudge}</div>}
      {guide.overlay}
    </>
  );
}
