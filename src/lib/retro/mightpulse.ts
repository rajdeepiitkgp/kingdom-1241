// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { createLogger, elapsedMs } from "@/lib/log";
import { type GovernorProfile, parseMightPulsePlayer } from "./governor";

/**
 * Governor ID lookup through the MightPulse API (https://api.mightpulse.com):
 * GET /v1/players/{governor_id} answers with the player's in-game name,
 * kingdom and alliance, or 404 for an unknown id. Server only: the key
 * (MIGHTPULSE_API_KEY, created there with a Discord sign-in) never leaves the
 * server, and the id is never logged.
 *
 * A player MightPulse hasn't refreshed for an hour makes their API wait while
 * it fetches from the game (up to 90 seconds on their side; concurrent requests
 * for the same player share that fetch), so the default timeout is generous and
 * the form retries a timed-out lookup a few seconds later.
 *
 * Fail-open by design: no key, a timeout, a rate limit or any other error is
 * reported as `unavailable`, and the form then simply lets the player type
 * their name and alliance. Only a clear "unknown player" answer blocks a
 * submission.
 */

export type GovernorLookup = { status: "found"; profile: GovernorProfile } | { status: "unknown" } | { status: "unavailable" };

const BASE_URL = "https://api.mightpulse.com/v1";
const DEFAULT_TIMEOUT_MS = 25_000;

const log = createLogger("mightpulse");

export function mightPulseConfigured(): boolean {
  return Boolean(process.env.MIGHTPULSE_API_KEY?.trim());
}

export async function lookupGovernor(governorId: string, options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<GovernorLookup> {
  const key = process.env.MIGHTPULSE_API_KEY?.trim();
  if (!key) return { status: "unavailable" };
  const fetchImpl = options.fetchImpl ?? fetch;
  const started = performance.now();
  try {
    const response = await fetchImpl(`${BASE_URL}/players/${encodeURIComponent(governorId)}?include=base`, {
      headers: { "X-Api-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.status === 404) {
      log.debug("MightPulse: unknown governor", { elapsedMs: elapsedMs(started) });
      return { status: "unknown" };
    }
    if (!response.ok) {
      // 401 = key problem, 429 = over the per-minute or daily budget, 5xx = their side. All fail open.
      log.warn("MightPulse answered with an error", { status: response.status, elapsedMs: elapsedMs(started) });
      return { status: "unavailable" };
    }
    const profile = parseMightPulsePlayer(await response.json(), governorId);
    if (!profile) {
      log.warn("MightPulse answer had an unexpected shape", { elapsedMs: elapsedMs(started) });
      return { status: "unavailable" };
    }
    log.debug("MightPulse: governor found", { kingdom: profile.kingdom, elapsedMs: elapsedMs(started) });
    return { status: "found", profile };
  } catch (error) {
    log.warn("MightPulse unreachable", { error: error instanceof Error ? error.message : String(error), elapsedMs: elapsedMs(started) });
    return { status: "unavailable" };
  }
}
