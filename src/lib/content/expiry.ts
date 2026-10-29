import { HOUR } from "@/lib/time";

/**
 * Texts that leave Home at a set time (an announcement's or a gift code's
 * expiry) while the pages are refreshed only once a day: the hourly
 * gift-code run expires their cache when one ran out recently (pure part).
 * Two hours back covers a late or skipped run; a second look at the same
 * expiry only refreshes Home once more.
 */
export const EXPIRY_LOOKBACK_MS = 2 * HOUR;

/** The span in which an expiry counts as recent: [now - lookback, now]. */
export function expiryWindow(now: Date): { from: string; to: string } {
  return { from: new Date(now.getTime() - EXPIRY_LOOKBACK_MS).toISOString(), to: now.toISOString() };
}
