"use server";

import { headers } from "next/headers";
import { getAlliances, getSettings } from "@/lib/data";
import { kvkSessionSecret } from "@/lib/kvk/access";
import type { LockoutPolicy } from "@/lib/kvk/throttle";
import { addressHash, clearThrottle, takeTry } from "@/lib/kvk/throttle-store";
import { createLogger, requestId } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOUR } from "@/lib/time";
import { FIELD, isGovernorId, isHoneypotFilled, normalizeGovernorId, parseRetroForm, type RetroErrors } from "./form";
import { retroAccess } from "./gate";
import { type GovernorProfile, signGovernor, verifyGovernor } from "./governor";
import { lookupGovernor as fetchGovernor, mightPulseConfigured } from "./mightpulse";
import { isOpenNow } from "./retention";

/**
 * Server Actions of the feedback form. Both are reachable by a direct POST, so
 * every check happens here: the battle-plan cookie, the open state, the
 * per-address budget, the Governor ID verification, the field rules and the
 * response cap. Texts, names and ids are never logged.
 */

export interface LookupState {
  /** `skipped`: no key, API down, over budget or not unlocked — the player types name and alliance (no message shown). */
  status: "idle" | "found" | "unknown" | "skipped";
  /** `skipped` because MightPulse didn't answer in time: worth another try in a few seconds (they may still be fetching). */
  retry?: boolean;
  name?: string;
  allianceTag?: string | null;
  /** Signed proof of the lookup, posted back with the form. */
  token?: string;
}

export interface SubmitState {
  status: "idle" | "ok" | "invalid" | "duplicate" | "closed" | "full" | "unknownGovernor" | "throttled" | "unavailable";
  errors?: RetroErrors;
  /** `throttled`: when (ms since epoch) this address may try again. */
  retryAt?: number;
}

/** Lookups per address and hour; past it the form just stops checking (nobody is told). */
const LOOKUP_POLICY: LockoutPolicy = { window: HOUR, maxFailures: 30, firstLock: HOUR, maxLock: HOUR };
/**
 * Failed submissions per address (a stored answer clears the count): a flood of
 * bounced forms is stopped, while players behind one carrier address can all
 * answer. Successful answers are limited by one per Governor ID and the cap.
 */
const SUBMIT_POLICY: LockoutPolicy = { window: HOUR, maxFailures: 8, firstLock: HOUR, maxLock: 6 * HOUR };

/** What the database raises when an answer would pass the retrospective's cap (migration 0023). */
const RETRO_FULL_SIGNAL = "kvk_retro_full";

const baseLog = createLogger("retro");

/** A profile only counts when MightPulse places the player in this kingdom (or doesn't say). */
async function inThisKingdom(profile: GovernorProfile): Promise<boolean> {
  if (profile.kingdom === null) return true;
  const settings = await getSettings();
  return profile.kingdom === settings.kingdomNumber;
}

/** Called while the player types their Governor ID. */
export async function lookupGovernor(rawId: string): Promise<LookupState> {
  const governorId = normalizeGovernorId(String(rawId ?? ""));
  if (!isGovernorId(governorId) || !mightPulseConfigured()) return { status: "skipped" };
  const requestHeaders = await headers();
  const log = baseLog.child({ reqId: requestId(requestHeaders) });
  const access = await retroAccess();
  if (!access?.unlocked) return { status: "skipped" };

  const now = Date.now();
  const budget = await takeTry(`mp:${access.retro.id}:${addressHash(requestHeaders)}`, now, LOOKUP_POLICY);
  if (!budget.allowed) {
    log.info("Governor lookup skipped: address over its hourly budget");
    return { status: "skipped" };
  }

  const result = await fetchGovernor(governorId);
  if (result.status === "unavailable") return { status: "skipped", retry: true };
  if (result.status === "unknown") return { status: "unknown" };
  if (!(await inThisKingdom(result.profile))) {
    log.info("Governor lookup: player belongs to another kingdom", { kingdom: result.profile.kingdom });
    return { status: "unknown" };
  }
  return {
    status: "found",
    name: result.profile.name,
    allianceTag: result.profile.allianceTag,
    token: signGovernor(result.profile, access.retro.id, now, kvkSessionSecret()),
  };
}

export async function submitRetro(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  const requestHeaders = await headers();
  const log = baseLog.child({ reqId: requestId(requestHeaders) });
  const access = await retroAccess();
  if (!access) return { status: "closed" };
  const { retro, unlocked } = access;
  if (!unlocked) {
    log.info("Feedback posted without the battle-plan cookie");
    return { status: "unavailable" };
  }
  const now = Date.now();
  if (!isOpenNow(retro, new Date(now)) || formData.get(FIELD.retroId) !== retro.id) return { status: "closed" };
  if (isHoneypotFilled(formData)) {
    log.info("Feedback dropped: honeypot filled", { retro: retro.id });
    return { status: "ok" }; // a bot learns nothing from a success message
  }

  const submitScope = `retro:${retro.id}:${addressHash(requestHeaders)}`;
  const budget = await takeTry(submitScope, now, SUBMIT_POLICY);
  if (!budget.allowed) {
    log.info("Feedback refused: address locked", { retro: retro.id, waitMs: budget.retryAt - now });
    return { status: "throttled", retryAt: budget.retryAt };
  }

  // Governor ID: the lookup token from the form, else one fresh lookup (fail-open).
  const governorId = normalizeGovernorId(String(formData.get(FIELD.governorId) ?? ""));
  let verified: GovernorProfile | null = null;
  const token = formData.get(FIELD.token);
  if (typeof token === "string" && token) {
    const proof = verifyGovernor(token, retro.id, now, kvkSessionSecret());
    if (proof && proof.governorId === governorId) verified = proof;
  }
  if (!verified && isGovernorId(governorId) && mightPulseConfigured()) {
    // Bounded: the player is waiting on the submit button; by now MightPulse usually has the player from the earlier lookup.
    const result = await fetchGovernor(governorId, { timeoutMs: 15_000 });
    if (result.status === "unknown") return { status: "unknownGovernor" };
    if (result.status === "found") {
      if (!(await inThisKingdom(result.profile))) return { status: "unknownGovernor" };
      verified = result.profile;
    }
  }

  const alliances = await getAlliances();
  const parsed = parseRetroForm(formData, retro.config, alliances.map((a) => a.tag), {
    verified: verified ? { name: verified.name, allianceTag: verified.allianceTag } : null,
  });
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
  const answer = parsed.value;

  const admin = createAdminClient();
  const { count, error: countError } = await admin.from("kvk_retro_responses").select("id", { count: "exact", head: true }).eq("retrospective_id", retro.id);
  if (countError) {
    log.error("Counting feedback failed", { retro: retro.id, error: countError.message });
    return { status: "unavailable" };
  }
  if ((count ?? 0) >= retro.maxResponses) {
    log.warn("Feedback refused: retrospective full", { retro: retro.id, count, max: retro.maxResponses });
    return { status: "full" };
  }

  const { error } = await admin.from("kvk_retro_responses").insert({
    retrospective_id: retro.id,
    governor_id: answer.governorId,
    game_name: answer.gameName,
    alliance_tag: answer.allianceTag,
    verified: verified !== null,
    ratings: answer.ratings,
    went_well: answer.texts.went_well,
    went_wrong: answer.texts.went_wrong,
    suggestions: answer.texts.suggestions,
    locale: answer.locale,
  });
  if (error) {
    if (error.code === "23505") {
      log.info("Feedback refused: Governor ID already answered", { retro: retro.id });
      return { status: "duplicate" };
    }
    if (error.message.includes(RETRO_FULL_SIGNAL)) {
      // Two answers at the same instant on the last free place: the database trigger (migration 0023) kept the cap.
      log.warn("Feedback refused: retrospective full (database)", { retro: retro.id, max: retro.maxResponses });
      return { status: "full" };
    }
    log.error("Saving feedback failed", { retro: retro.id, error: error.message, code: error.code });
    return { status: "unavailable" };
  }
  await clearThrottle(submitScope);
  log.info("Feedback recorded", {
    retro: retro.id,
    verified: verified !== null,
    locale: answer.locale,
    ratings: Object.keys(answer.ratings).length,
    textChars: Object.values(answer.texts).reduce((n, t) => n + t.length, 0),
    total: (count ?? 0) + 1,
  });
  return { status: "ok" };
}
