"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { type BrowserState, OPT_OUT_KEY, trackedEvent } from "@/lib/analytics";

/**
 * Vercel Web Analytics (visitors and page views per day, by page, country and
 * device) and Speed Insights (the Real Experience Score per page). The root
 * layout draws this on Vercel only (`showAnalytics`); both must be switched
 * on in the Vercel dashboard before the deploy that carries them (SETUP.md
 * § 5). Nothing is stored in the browser: Vercel tells visitors apart by a
 * hash of the request that it drops after a day. Browsers of signed-in
 * council members and browsers that opted out send nothing, so the council's
 * own visits never count as players. The scripts load after the page and
 * fail quietly where an ad blocker stops them.
 */

/**
 * The share of page views that send their speed measurements. The free tier
 * takes 10,000 measurements over 30 days across the team (each page view
 * sends one per metric) and pauses for at least two weeks above that; lower
 * this when the pause comes too often.
 */
const SPEED_INSIGHTS_SAMPLE_RATE = 1;

function browserState(): BrowserState {
  let cookie = "";
  let optOut: string | null = null;
  try {
    cookie = document.cookie;
  } catch {
    // A browser that refuses cookies still counts as a visitor.
  }
  try {
    optOut = window.localStorage.getItem(OPT_OUT_KEY);
  } catch {
    // Storage blocked (private window, cleared site data): counts as a visitor.
  }
  return { cookie, optOut };
}

function keep<T>(event: T): T | null {
  return trackedEvent(event, browserState());
}

export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={keep} />
      <SpeedInsights sampleRate={SPEED_INSIGHTS_SAMPLE_RATE} beforeSend={keep} />
    </>
  );
}
