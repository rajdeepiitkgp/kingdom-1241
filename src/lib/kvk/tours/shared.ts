// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { uiStep } from "@/lib/tour/tour";

/**
 * The guided tours of the KvK pages, opened from "Guided tour" in each page's
 * header, one file per page so a page's import graph carries only its own
 * tour's strings (tests/architecture/page-strings.test.ts). A locked page
 * shows only its password card, so its tour is the password step; once
 * unlocked, the same tour walks through the content (steps whose part isn't
 * on the page are left out). These two steps are shared by the locked pages.
 */

export const header = uiStep("kvk-header", "kvk.header");
export const lock = uiStep("kvk-lock", "kvk.lock", "kvk.lock");
