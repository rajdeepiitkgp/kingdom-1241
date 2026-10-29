// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { GUIDE_ALLIANCE_KEY } from "@/lib/content/guide-sections";

/**
 * The alliance this device picked last in a guide (browser only, guarded):
 * read by the guides' alliance tabs, written by a tab or by a guide link on
 * an alliance page. Blocked storage just means the pick isn't kept.
 */

/** Same-tab writes don't fire "storage", so a pick tells the other guide tabs on the page through this event. */
const PICKED = "kd1241:guide-alliance";

export function subscribeAlliance(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PICKED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PICKED, onChange);
  };
}

export function readRememberedAlliance(): string | null {
  try {
    return window.localStorage.getItem(GUIDE_ALLIANCE_KEY);
  } catch {
    return null; // storage blocked: the tabs still work, the pick just isn't kept
  }
}

export const readNoAlliance = () => null;

export function rememberAlliance(tag: string) {
  try {
    window.localStorage.setItem(GUIDE_ALLIANCE_KEY, tag);
    window.dispatchEvent(new Event(PICKED));
  } catch {
    // Not kept on this device; the tab still switches.
  }
}
