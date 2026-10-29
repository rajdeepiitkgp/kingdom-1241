import { DAY } from "@/lib/time";

/**
 * Texts that leave Home at a set time (an announcement's or a gift code's
 * expiry) while the pages are refreshed only once a day: the gift-code run
 * expires their cache when one ran out since its last look (pure part).
 * GitHub runs that "hourly" schedule when it can, often hours apart, so the
 * window starts at the previous check (app_config `last_expiry_check`), not a
 * fixed span: every expiry refreshes Home exactly once, however late the run.
 */

/** Never further back than this: anything older is already gone with the daily refresh. */
export const EXPIRY_MAX_LOOKBACK_MS = DAY;

/** The span in which an expiry counts as new: (last check, now], or the last day without a usable note. */
export function expiryWindow(now: Date, lastCheck: unknown): { from: string; to: string } {
  const floor = now.getTime() - EXPIRY_MAX_LOOKBACK_MS;
  const at = lastCheck && typeof lastCheck === "object" ? Date.parse(String((lastCheck as { at?: unknown }).at)) : Number.NaN;
  const from = Number.isNaN(at) || at > now.getTime() ? floor : Math.max(at, floor);
  return { from: new Date(from).toISOString(), to: now.toISOString() };
}
