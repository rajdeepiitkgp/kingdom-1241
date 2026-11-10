// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { getAlliances, getSettings } from "@/lib/data";
import { kvkSessionSecret } from "@/lib/kvk/access";
import type { ScoringDay } from "@/lib/kvk/prep";
import type { LockoutPolicy } from "@/lib/kvk/throttle";
import { addressHash, clearThrottle, takeTry } from "@/lib/kvk/throttle-store";
import { createLogger, requestId } from "@/lib/log";
import { isGovernorId, isHoneypotFilled, normalizeGovernorId } from "@/lib/retro/form";
import { type GovernorProfile, signGovernor, verifyGovernor } from "@/lib/retro/governor";
import { lookupGovernor as fetchGovernor, mightPulseConfigured } from "@/lib/retro/mightpulse";
import { HOUR } from "@/lib/time";
import { FIELD, isDeviceKey, parseSignupForm, type SignupErrors } from "./form";
import { type Amounts, MAX_SIGNUPS_PER_ROUND, type SlotChoice } from "./ministry";
import { rosterDays, rosterFor } from "./roster";
import { type MinistryRound, ministryUnlocked, openDays, openMinistryRound } from "./state";
import { type MinistryStore, ministryStore, type StoredSignup } from "./store";

/**
 * Server Actions of the ministry sign-up page. All are reachable by a direct
 * POST, so every check happens here: the battle-plan cookie, the open round,
 * each day's deadline, the per-address budget, the Governor ID and the key of
 * the browser that owns an entry. Names and ids are never logged.
 */

export interface LookupState {
  /** `skipped`: no key, API down, over budget or not unlocked: the player types name and alliance (no message shown). */
  status: "idle" | "found" | "unknown" | "skipped";
  /** `skipped` because MightPulse didn't answer in time: worth another try in a few seconds. */
  retry?: boolean;
  name?: string;
  allianceTag?: string | null;
  /** Signed proof of the lookup, posted back with the form. */
  token?: string;
}

/** A sign-up as the browser that made it gets it back: no id of the row, no device hash. */
export interface MySignup {
  governorId: string;
  gameName: string;
  allianceTag: string | null;
  verified: boolean;
  amounts: Amounts;
  slots: SlotChoice;
  disabled: boolean;
  /** Per buff day whose appointments are given out: the player's half-hour slot, or null when they got none. A day not listed isn't assigned yet. */
  appointments: Partial<Record<ScoringDay, number | null>>;
}

/** What "find me" on the roster answers: the appointments of one Governor ID, per assigned day. */
export interface FindState {
  status: "found" | "none" | "skipped";
  name?: string;
  appointments?: Partial<Record<ScoringDay, number | null>>;
}

export interface SubmitState {
  status: "idle" | "ok" | "invalid" | "taken" | "closed" | "full" | "unknownGovernor" | "throttled" | "unavailable";
  errors?: SignupErrors;
  /** `throttled`: when (ms since epoch) this address may try again. */
  retryAt?: number;
  /** `ok`: every sign-up of this browser in the round, the saved one included. */
  mine?: MySignup[];
  /** `ok`: the Governor ID that was saved. */
  saved?: string;
}

export interface WithdrawState {
  status: "ok" | "locked" | "gone" | "unavailable";
  mine?: MySignup[];
}

/** Lookups per address and hour; past it the form just stops checking (nobody is told). */
const LOOKUP_POLICY: LockoutPolicy = { window: HOUR, maxFailures: 30, firstLock: HOUR, maxLock: HOUR };
/** Failed submissions per address (a stored sign-up clears the count), so players behind one carrier address can all sign up. */
const SUBMIT_POLICY: LockoutPolicy = { window: HOUR, maxFailures: 12, firstLock: HOUR, maxLock: 6 * HOUR };

const baseLog = createLogger("ministry");

const deviceHash = (key: string): string => createHash("sha256").update(key).digest("hex");
const tokenScope = (round: MinistryRound): string => `ministry:${round.key}`;

/** Each entry's appointment on the days that are given out (none on a day the player sits out). */
function appointmentsOf(row: StoredSignup, held: ReadonlyArray<{ signupId: string; day: ScoringDay; slot: number }>, days: readonly ScoringDay[]): MySignup["appointments"] {
  const appointments: MySignup["appointments"] = {};
  for (const day of days) {
    if ((row.slots[day]?.length ?? 0) === 0 && !held.some((entry) => entry.signupId === row.id && entry.day === day)) continue;
    appointments[day] = held.find((entry) => entry.signupId === row.id && entry.day === day)?.slot ?? null;
  }
  return appointments;
}

/** This browser's entries in the round, each with its appointments (reading the roster runs a due assignment). */
async function mine(store: MinistryStore, round: MinistryRound, device: string, now: Date): Promise<MySignup[]> {
  const rows = await store.byDevice(round.key, device);
  if (rows.length === 0) return [];
  const roster = await rosterFor(store, round, now);
  const days = rosterDays(round, roster, now);
  return rows.map((row) => ({
    governorId: row.governorId,
    gameName: row.gameName,
    allianceTag: row.allianceTag,
    verified: row.verified,
    amounts: row.amounts,
    slots: row.slots,
    disabled: row.disabled,
    appointments: row.disabled ? {} : appointmentsOf(row, roster.appointments, days),
  }));
}

/** A profile only counts when MightPulse places the player in this kingdom (or doesn't say). */
async function inThisKingdom(profile: GovernorProfile): Promise<boolean> {
  if (profile.kingdom === null) return true;
  const settings = await getSettings();
  return profile.kingdom === settings.kingdomNumber;
}

/** The open round for a visitor who has the plan unlocked, else null. */
async function roundForVisitor(now: Date): Promise<MinistryRound | null> {
  const access = await ministryUnlocked();
  if (!access.unlocked) return null;
  return openMinistryRound(now);
}

/** Called while the player types their Governor ID. */
export async function lookupMinistryGovernor(rawId: string): Promise<LookupState> {
  const governorId = normalizeGovernorId(String(rawId ?? ""));
  if (!isGovernorId(governorId) || !mightPulseConfigured()) return { status: "skipped" };
  const requestHeaders = await headers();
  const log = baseLog.child({ reqId: requestId(requestHeaders) });
  const now = Date.now();
  const round = await roundForVisitor(new Date(now));
  if (!round) return { status: "skipped" };

  const budget = await takeTry(`mp:ministry:${round.key}:${addressHash(requestHeaders)}`, now, LOOKUP_POLICY);
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
  return { status: "found", name: result.profile.name, allianceTag: result.profile.allianceTag, token: signGovernor(result.profile, tokenScope(round), now, kvkSessionSecret()) };
}

/** The sign-ups this browser made in the open round (its key never leaves it except to ask this). */
export async function myMinistrySignups(deviceKey: string): Promise<MySignup[]> {
  if (!isDeviceKey(deviceKey)) return [];
  const now = new Date();
  const round = await roundForVisitor(now);
  const store = ministryStore();
  if (!round || !store) return [];
  try {
    return await mine(store, round, deviceHash(deviceKey), now);
  } catch (error) {
    baseLog.warn("Could not read a browser's sign-ups", { round: round.key, error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return [];
  }
}

export async function submitMinistrySignup(_previous: SubmitState, formData: FormData): Promise<SubmitState> {
  const requestHeaders = await headers();
  const log = baseLog.child({ reqId: requestId(requestHeaders) });
  const now = Date.now();
  const access = await ministryUnlocked();
  if (!access.unlocked) {
    log.info("Ministry sign-up posted without the battle-plan cookie");
    return { status: "unavailable" };
  }
  const store = ministryStore();
  const round = await openMinistryRound(new Date(now));
  if (!store || !round || formData.get(FIELD.round) !== round.key) return { status: "closed" };
  const open: ScoringDay[] = openDays(round, new Date(now));
  if (open.length === 0) return { status: "closed" };
  if (isHoneypotFilled(formData)) {
    log.info("Ministry sign-up dropped: honeypot filled", { round: round.key });
    return { status: "ok", mine: [] }; // a bot learns nothing from a success message
  }
  const deviceKey = formData.get(FIELD.deviceKey);
  if (!isDeviceKey(deviceKey)) return { status: "unavailable" };
  const device = deviceHash(deviceKey);

  const submitScope = `ministry:${round.key}:${addressHash(requestHeaders)}`;
  const budget = await takeTry(submitScope, now, SUBMIT_POLICY);
  if (!budget.allowed) {
    log.info("Ministry sign-up refused: address locked", { round: round.key, waitMs: budget.retryAt - now });
    return { status: "throttled", retryAt: budget.retryAt };
  }

  try {
    const governorId = normalizeGovernorId(String(formData.get(FIELD.governorId) ?? ""));
    const existing = isGovernorId(governorId) ? await store.byGovernor(round.key, governorId) : null;
    // An entry belongs to the browser that made it; anyone else asks a moderator.
    if (existing && existing.deviceHash !== device) {
      log.info("Ministry sign-up refused: the Governor ID is signed up from another browser", { round: round.key });
      return { status: "taken" };
    }

    // Governor ID: the lookup token from the form, else one fresh lookup (fail-open). A change keeps what was verified before.
    let verified: GovernorProfile | null = null;
    const token = formData.get(FIELD.token);
    if (typeof token === "string" && token) {
      const proof = verifyGovernor(token, tokenScope(round), now, kvkSessionSecret());
      if (proof && proof.governorId === governorId) verified = proof;
    }
    if (!verified && !existing && isGovernorId(governorId) && mightPulseConfigured()) {
      const result = await fetchGovernor(governorId, { timeoutMs: 15_000 });
      if (result.status === "unknown") return { status: "unknownGovernor" };
      if (result.status === "found") {
        if (!(await inThisKingdom(result.profile))) return { status: "unknownGovernor" };
        verified = result.profile;
      }
    }
    const known = verified ? { name: verified.name, allianceTag: verified.allianceTag } : existing?.verified ? { name: existing.gameName, allianceTag: existing.allianceTag } : null;

    const alliances = await getAlliances();
    const parsed = parseSignupForm(formData, alliances.map((a) => a.tag), { verified: known, sections: round.sections, openDays: open, existing });
    if (!parsed.ok) return { status: "invalid", errors: parsed.errors };
    const entry = parsed.value;

    if (existing) {
      const saved = await store.update(existing.id, {
        gameName: entry.gameName,
        allianceTag: entry.allianceTag,
        verified: existing.verified || verified !== null,
        power: verified?.power ?? existing.power,
        amounts: entry.amounts,
        slots: entry.slots,
        locale: entry.locale,
      });
      if (!saved) return { status: "unavailable" };
      log.info("Ministry sign-up changed", { round: round.key, days: Object.keys(entry.slots).length });
    } else {
      if ((await store.count(round.key)) >= MAX_SIGNUPS_PER_ROUND) {
        log.warn("Ministry sign-up refused: the round is full", { round: round.key, max: MAX_SIGNUPS_PER_ROUND });
        return { status: "full" };
      }
      const saved = await store.insert({
        round: round.key,
        governorId: entry.governorId,
        gameName: entry.gameName,
        allianceTag: entry.allianceTag,
        verified: verified !== null,
        power: verified?.power ?? null,
        amounts: entry.amounts,
        slots: entry.slots,
        locale: entry.locale,
        deviceHash: device,
      });
      // Two posts for one Governor ID at the same instant: the second one lost.
      if (saved === "duplicate") return { status: "taken" };
      log.info("Ministry sign-up recorded", { round: round.key, verified: verified !== null, days: Object.keys(entry.slots).length, locale: entry.locale });
    }
    await clearThrottle(submitScope);
    return { status: "ok", saved: entry.governorId, mine: await mine(store, round, device, new Date(now)) };
  } catch (error) {
    log.error("Saving a ministry sign-up failed", { round: round.key, error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return { status: "unavailable" };
  }
}

/** The player takes an entry of this browser back; only while none of its days has passed its deadline (after that a moderator does it). */
export async function withdrawMinistrySignup(deviceKey: string, rawGovernorId: string): Promise<WithdrawState> {
  const requestHeaders = await headers();
  const log = baseLog.child({ reqId: requestId(requestHeaders) });
  const now = new Date();
  const governorId = normalizeGovernorId(String(rawGovernorId ?? ""));
  const round = await roundForVisitor(now);
  const store = ministryStore();
  if (!round || !store || !isDeviceKey(deviceKey) || !isGovernorId(governorId)) return { status: "unavailable" };
  const device = deviceHash(deviceKey);
  try {
    const existing = await store.byGovernor(round.key, governorId);
    if (!existing || existing.deviceHash !== device) return { status: "gone", mine: await mine(store, round, device, now) };
    const open = openDays(round, now);
    const frozen = round.sections.some(({ day }) => (existing.slots[day]?.length ?? 0) > 0 && !open.includes(day));
    if (frozen) return { status: "locked" };
    await store.remove(existing.id);
    log.info("Ministry sign-up withdrawn by its browser", { round: round.key });
    return { status: "ok", mine: await mine(store, round, device, now) };
  } catch (error) {
    log.error("Withdrawing a ministry sign-up failed", { round: round.key, error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return { status: "unavailable" };
  }
}

/** "Find me" on the roster: the appointments of a Governor ID on the days that are given out. The roster never carries the IDs itself. */
export async function findMinistryAppointments(rawId: string): Promise<FindState> {
  const governorId = normalizeGovernorId(String(rawId ?? ""));
  if (!isGovernorId(governorId)) return { status: "none" };
  const requestHeaders = await headers();
  const now = new Date();
  const round = await roundForVisitor(now);
  const store = ministryStore();
  if (!round || !store) return { status: "skipped" };
  const budget = await takeTry(`mp:ministry:find:${round.key}:${addressHash(requestHeaders)}`, now.getTime(), LOOKUP_POLICY);
  if (!budget.allowed) return { status: "skipped" };
  try {
    const row = await store.byGovernor(round.key, governorId);
    if (!row || row.disabled) return { status: "none" };
    const roster = await rosterFor(store, round, now);
    return { status: "found", name: `${row.allianceTag ? `[${row.allianceTag}] ` : ""}${row.gameName}`, appointments: appointmentsOf(row, roster.appointments, rosterDays(round, roster, now)) };
  } catch (error) {
    baseLog.warn("Could not look a Governor ID up on the roster", { round: round.key, error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return { status: "skipped" };
  }
}
