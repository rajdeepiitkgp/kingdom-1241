/**
 * Clock correction for the room page (pure, unit-tested). Every state request
 * returns the server's clock; assuming the answer took as long to come back as
 * the request took to go, the device's offset is server − midpoint. The sample
 * with the shortest round trip is the most trustworthy (a cold start or a slow
 * network only make one leg long). The offset moves the countdown and the
 * clock on the page, never the UTC start times, which are exact.
 */

export interface ClockSample {
  /** Server clock minus device clock (ms). */
  offset: number;
  /** Round trip (ms). */
  rtt: number;
}

export function clockSample(sentAt: number, receivedAt: number, serverNow: number): ClockSample {
  return { offset: serverNow - (sentAt + receivedAt) / 2, rtt: Math.max(0, receivedAt - sentAt) };
}

/** Keep the latest few samples (the device clock may be corrected meanwhile). */
export const CLOCK_SAMPLES = 8;

export function bestOffset(samples: readonly ClockSample[]): number {
  if (samples.length === 0) return 0;
  return samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
}

/** Below this the device counts as in sync (the page says nothing). */
export const NOTABLE_OFFSET_MS = 500;
