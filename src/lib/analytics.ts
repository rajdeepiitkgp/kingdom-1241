/**
 * Vercel Web Analytics and Speed Insights: the pure parts of what a browser
 * sends. Both scripts are served by Vercel's routing layer, so the root
 * layout draws them on Vercel only (`showAnalytics`): anywhere else (local
 * builds, the Playwright test server) the script would answer 404, and the
 * browser suite's console-error rule would fail every test. A browser whose
 * visits shouldn't count sends nothing (`trackedEvent`): a signed-in council
 * member's (the admin marker cookie), or one that opted out through Vercel's
 * documented `va-disable` flag, which the daily live check sets so its test
 * devices never appear as visitors.
 */

import { hasSessionMarker } from "@/lib/auth/session-hint";

/** Vercel's own opt-out convention: any value under this localStorage key means "don't count this browser". */
export const OPT_OUT_KEY = "va-disable";

/** What the browser knows about itself when an event is about to leave. */
export interface BrowserState {
  /** `document.cookie`, or "" where the browser refuses to say. */
  cookie: string;
  /** The value under `OPT_OUT_KEY`, null when unset or unreadable. */
  optOut: string | null;
}

/** True on Vercel, where the scripts are served (`VERCEL` is set on every build and function there, nowhere else). */
export function showAnalytics(env: Record<string, string | undefined>): boolean {
  return Boolean(env.VERCEL);
}

/** The event to send, or null for a browser that shouldn't count. */
export function trackedEvent<T>(event: T, browser: BrowserState): T | null {
  if (hasSessionMarker(browser.cookie)) return null;
  if (browser.optOut !== null) return null;
  return event;
}
