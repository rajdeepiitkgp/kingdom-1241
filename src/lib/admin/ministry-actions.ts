// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess, type CurrentUser } from "@/lib/auth/server";
import { getAlliances, getSettings } from "@/lib/data";
import { FIELD, parseSignupForm, type SignupErrorCode } from "@/lib/ministry/form";
import { firstFreeOwn, placementProblem } from "@/lib/ministry/assign";
import { CLOSED_ROUND, deadlineFor, isScoringDay, joined, MAX_SIGNUPS_PER_ROUND, parseRoundSettingsForm, roundsClosedBy, sectionOn, slotLabel, SLOTS_PER_DAY, withRoundSettings } from "@/lib/ministry/ministry";
import { closedDays, runAssignment } from "@/lib/ministry/roster";
import { ministryRounds } from "@/lib/ministry/state";
import { isGovernorId, normalizeGovernorId } from "@/lib/retro/form";
import type { GovernorProfile } from "@/lib/retro/governor";
import { lookupGovernor, mightPulseConfigured } from "@/lib/retro/mightpulse";
import { ministryMemory, type MinistryStore, ministryStore, type StoredSignup } from "@/lib/ministry/store";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { type FieldErrors, localeField, textField, uuidField } from "./forms";

/**
 * Server Actions of the admin ministry page (moderators and up): open a
 * round's sign-ups and set each buff day's deadline; add an entry by hand,
 * change one, set it aside or remove it; run a buff day's assignment again and
 * place a player by hand; administrators empty a round. A moderator's change is not bound by the deadlines
 * or by the browser that made the entry. Every one is audited (never with a
 * Governor ID).
 */

const NO_STORE: ActionState = { status: "error", message: "The ministry sign-ups need the database (migration 0026)." };
const NO_ROSTER_TABLE: ActionState = { status: "error", message: "The appointments need migration 0027, which isn't applied yet." };
const NOT_FOUND: ActionState = { status: "error", message: "That sign-up is no longer on the list. Reload the page." };

const ERROR_TEXT: Record<SignupErrorCode, string> = {
  required: "Fill in this field.",
  invalid: "Check this field.",
  tooLong: "Too long.",
  tooMuch: "That number is too large.",
  noSlots: "Pick at least one time for this day.",
  noAmount: "Enter what the player will use on this day.",
};

/** The local review store keeps nothing in the database, so it writes no audit entry either. */
async function record(actor: CurrentUser, action: string, rowId: string | null, details: Record<string, unknown>): Promise<void> {
  if (ministryMemory()) return;
  await audit(actor, action, rowId ? "ministry_signups" : "app_config", rowId ?? "ministry", details);
}

const problem = (error: unknown): { message: string } => ({ message: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });

function changed(formData: FormData) {
  revalidatePath(adminPath(localeField(formData), "/ministry"));
}

export async function saveMinistryRound(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  try {
    const { rounds } = await ministryRounds(new Date(), store);
    const parsed = parseRoundSettingsForm(formData, rounds);
    if (!parsed.ok) return invalid(parsed.errors);
    const { round, settings } = parsed.value;
    const stored = await store.settings();
    const before = stored[round] ?? CLOSED_ROUND;
    // One round is open at a time: opening this one closes the other.
    const closed = roundsClosedBy(stored, round, settings, rounds[0].key);
    await store.saveSettings(withRoundSettings(stored, round, settings, rounds[0].key));
    // A deadline moved back into the future opens the day's sign-ups again: its roster goes, and the assignment runs anew at the new deadline.
    const saved = rounds.find((entry) => entry.key === round);
    const reopened: number[] = [];
    if (saved) {
      const roster = await store.roster(round);
      for (const { day } of saved.sections) {
        if (roster.assignedAt[day] && deadlineFor(settings, saved.round, day).getTime() > Date.now()) {
          await store.clearRoster(round, day);
          reopened.push(day);
        }
      }
    }
    await record(access.user, "ministry.round", null, { round, before, after: settings, closed, ...(reopened.length > 0 ? { rostersCleared: reopened } : {}) });
    log.info("Ministry round saved", { round, open: settings.open, closed: closed.length });
    changed(formData);
    const cleared = reopened.length > 0 ? ` Day ${reopened.join(" and Day ")} is open for sign-ups again, so its appointments were taken back; they are given out anew at the new deadline.` : "";
    if (!settings.open) return { status: "saved", message: `Saved. Sign-ups for this round are closed.${cleared}` };
    return {
      status: "saved",
      message: `Saved. Players with the battle plan unlocked can sign up for this round now.${closed.length > 0 ? " The other round is closed: only one round is open at a time. Its entries and deadlines are kept." : ""}${cleared}`,
    };
  } catch (error) {
    return failed(log, "Saving the ministry round", problem(error));
  }
}

/** What MightPulse says about a Governor ID a moderator typed. `elsewhere`: a player of another kingdom. `unavailable`: no answer (or no key), so nothing is known. */
export interface EntryLookup {
  status: "found" | "unknown" | "elsewhere" | "unavailable";
  name?: string;
  allianceTag?: string | null;
}

/** The player behind a Governor ID in this kingdom, or why there is none to name. Never throws. */
async function governorOfKingdom(governorId: string): Promise<{ status: EntryLookup["status"]; profile?: GovernorProfile }> {
  if (!mightPulseConfigured()) return { status: "unavailable" };
  const result = await lookupGovernor(governorId);
  if (result.status !== "found") return { status: result.status };
  const { kingdomNumber } = await getSettings();
  if (result.profile.kingdom !== null && result.profile.kingdom !== kingdomNumber) return { status: "elsewhere" };
  return { status: "found", profile: result.profile };
}

/** The add form's help: the name and alliance of a typed Governor ID. It never blocks an entry: a moderator may add any number (a test entry, a player MightPulse hasn't seen). */
export async function lookupMinistryEntryGovernor(rawId: string): Promise<EntryLookup> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return { status: "unavailable" };
  const governorId = normalizeGovernorId(String(rawId ?? ""));
  if (!isGovernorId(governorId)) return { status: "unavailable" };
  const { status, profile } = await governorOfKingdom(governorId);
  return profile ? { status, name: profile.name, allianceTag: profile.allianceTag } : { status };
}

/**
 * An entry a moderator added, changed or put back after a day's appointments were given out: on every such day the
 * player takes part in and holds no appointment, they get the earliest free time among their own. Nobody else moves
 * (the roster is out), so a day without a free time of theirs is named for the moderator to settle by hand.
 * Returns the sentence for the notice ("" when no day is given out yet). Never throws.
 */
async function placeAfterwards(store: MinistryStore, signup: StoredSignup, days: readonly number[]): Promise<string> {
  try {
    if (signup.disabled) return "";
    const roster = await store.roster(signup.round);
    const placed: string[] = [];
    const none: number[] = [];
    for (const day of days) {
      if (!isScoringDay(day) || !roster.assignedAt[day] || (signup.slots[day]?.length ?? 0) === 0) continue;
      if (roster.appointments.some((held) => held.day === day && held.signupId === signup.id)) continue;
      const slot = firstFreeOwn(roster.appointments, day, signup.slots[day] ?? []);
      if (slot !== null && (await store.place(signup.round, day, signup.id, slot, "auto")) === "ok") placed.push(`Day ${day} ${slotLabel(slot)} UTC`);
      else none.push(day);
    }
    return `${placed.length > 0 ? ` The appointments of ${placed.length === 1 ? "that day are" : "those days are"} given out already, so the player got the earliest free time among their own: ${placed.join(", ")}.` : ""}${none.length > 0 ? ` On Day ${none.join(" and Day ")} none of their times is free: move them by hand in that day's table.` : ""}`;
  } catch {
    return " Their appointment could not be set; use Assign again on the day's tab.";
  }
}

/** Add an entry by hand (no `id`) or change one. The Governor ID of an existing entry stays. */
export async function saveMinistryEntry(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  try {
    const { rounds } = await ministryRounds(new Date(), store);
    const round = rounds.find((entry) => entry.key === textField(formData, FIELD.round));
    if (!round) return { status: "error", message: "Pick one of the rounds shown. Reload the page." };
    const id = uuidField(formData, "id");
    const existing = id ? await store.get(id) : null;
    if (id && (!existing || existing.round !== round.key)) return NOT_FOUND;

    const alliances = await getAlliances();
    const parsed = parseSignupForm(formData, alliances.map((a) => a.tag), { verified: null, sections: round.sections, openDays: round.sections.map((section) => section.day), existing });
    if (!parsed.ok) {
      const errors: FieldErrors = Object.fromEntries(Object.entries(parsed.errors).map(([field, code]) => [field, ERROR_TEXT[code]]));
      return invalid(errors, errors[FIELD.sections] ? "The player has to take part in at least one day." : undefined);
    }
    const entry = parsed.value;

    if (existing) {
      const nameChanged = entry.gameName !== existing.gameName || entry.allianceTag !== existing.allianceTag;
      await store.update(existing.id, { gameName: entry.gameName, allianceTag: entry.allianceTag, verified: existing.verified && !nameChanged, amounts: entry.amounts, slots: entry.slots });
      // A day the player no longer takes part in gives its appointment back.
      await store.unplace(existing.id, round.sections.map((section) => section.day).filter((day) => (entry.slots[day]?.length ?? 0) === 0));
      await record(access.user, "ministry.signup_edit", existing.id, { round: round.key, name: entry.gameName, before: { amounts: existing.amounts, slots: existing.slots }, after: { amounts: entry.amounts, slots: entry.slots } });
      const after = await store.get(existing.id);
      const note = after ? await placeAfterwards(store, after, round.sections.map((section) => section.day)) : "";
      changed(formData);
      return { status: "saved", message: `Saved ${entry.gameName}.${note}` };
    }
    if ((await store.count(round.key)) >= MAX_SIGNUPS_PER_ROUND) return { status: "error", message: `The round has ${MAX_SIGNUPS_PER_ROUND} sign-ups, the most it takes. Remove one first.` };
    // Confirmed like a player's own sign-up when the name and alliance are the ones MightPulse has for the ID; anything else is stored as typed.
    const { profile } = await governorOfKingdom(entry.governorId);
    const confirmed = profile !== undefined && profile.name === entry.gameName && profile.allianceTag === entry.allianceTag;
    const saved = await store.insert({
      round: round.key,
      governorId: entry.governorId,
      gameName: entry.gameName,
      allianceTag: entry.allianceTag,
      verified: confirmed,
      power: confirmed ? (profile.power ?? null) : null,
      amounts: entry.amounts,
      slots: entry.slots,
      locale: "en",
      deviceHash: null,
    });
    if (saved === "duplicate") return invalid({ [FIELD.governorId]: "That Governor ID is signed up already. Change its entry in the list." });
    await record(access.user, "ministry.signup_add", saved.id, { round: round.key, name: entry.gameName });
    const note = await placeAfterwards(store, saved, round.sections.map((section) => section.day));
    changed(formData);
    return { status: "saved", message: `${entry.gameName} is on the list.${note}` };
  } catch (error) {
    return failed(log, "Saving the ministry sign-up", problem(error));
  }
}

export async function setMinistryEntryDisabled(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  const disabled = textField(formData, "disabled") === "1";
  try {
    const saved = await store.update(id, { disabled });
    if (!saved) return NOT_FOUND;
    // Set aside = off the lists and the rosters: the appointments are free again.
    if (disabled) await store.unplace(id);
    const note = disabled ? "" : await placeAfterwards(store, saved, [1, 2, 3, 4, 5]);
    await record(access.user, disabled ? "ministry.signup_disable" : "ministry.signup_enable", id, { round: saved.round, name: saved.gameName });
    changed(formData);
    return { status: "saved", message: disabled ? `${saved.gameName} is set aside: kept, but left out of the lists, and any appointment is free again.` : `${saved.gameName} is back on the lists.${note}` };
  } catch (error) {
    return failed(log, "Setting the ministry sign-up aside", problem(error));
  }
}

export async function removeMinistryEntry(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  try {
    const existing = await store.get(id);
    if (!existing || !(await store.remove(id))) return NOT_FOUND;
    await record(access.user, "ministry.signup_remove", id, { round: existing.round, name: existing.gameName });
    changed(formData);
    return { status: "saved", message: `${existing.gameName} is removed. The player can sign up again.` };
  } catch (error) {
    return failed(log, "Removing the ministry sign-up", problem(error));
  }
}

/** Administrators: every sign-up of a round goes, with its appointments (a clean start after testing). The round's switch and deadlines stay. */
export async function removeAllMinistryEntries(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("admin");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  try {
    const { rounds } = await ministryRounds(new Date(), store);
    const round = rounds.find((entry) => entry.key === textField(formData, "round"));
    if (!round) return { status: "error", message: "Pick one of the rounds shown. Reload the page." };
    const count = await store.removeRound(round.key);
    await record(access.user, "ministry.signup_remove_all", null, { round: round.key, count });
    log.info("Ministry round emptied", { round: round.key, count });
    changed(formData);
    return { status: "saved", message: count === 0 ? "The round had no sign-ups." : `Removed ${count} sign-up${count === 1 ? "" : "s"} and their appointments. The round's switch and deadlines are as they were.` };
  } catch (error) {
    return failed(log, "Removing the round's ministry sign-ups", problem(error));
  }
}

const dayField = (formData: FormData): number => Number(textField(formData, "day"));

/** Runs a buff day's assignment again (after its deadline): players placed by hand and late players stay, the rest is placed anew. With `fresh` those are forgotten too. */
export async function assignMinistryDay(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  try {
    const now = new Date();
    const { rounds } = await ministryRounds(now, store);
    const round = rounds.find((entry) => entry.key === textField(formData, "round"));
    const day = dayField(formData);
    if (!round || !isScoringDay(day) || !sectionOn(round.sections, day)) return { status: "error", message: "Pick one of the buff days shown. Reload the page." };
    if (!closedDays(round, now).includes(day)) {
      return { status: "error", message: "Players can still sign up for this day. The appointments are given out by themselves at the deadline; to do it now, set the day's deadline to a time that has passed." };
    }
    // From scratch: the times placed by hand (and those of players who took a free one) are forgotten first, so everyone is placed by the rules alone.
    const fresh = textField(formData, "fresh") === "1";
    if (fresh) await store.clearRoster(round.key, day);
    const run = await runAssignment(store, round, day, false);
    if (run.outcome === "unavailable") return NO_ROSTER_TABLE;
    if (run.outcome === "clash") return { status: "error", message: "A player took a free appointment at the same moment, so nothing was changed. Press the button again." };
    await record(access.user, "ministry.assign", null, { round: round.key, day, placed: run.placed, unplaced: run.unplaced, at: "button", ...(fresh ? { fresh: true } : {}) });
    log.info("Ministry assignment ran", { round: round.key, day, placed: run.placed, unplaced: run.unplaced });
    changed(formData);
    return {
      status: "saved",
      message: `Done for Day ${day}. The assignment gave out ${run.placed} appointment${run.placed === 1 ? "" : "s"}${fresh ? " from scratch: every earlier placing of this day, also by hand, is forgotten" : "; players placed by hand and players who took a free appointment kept theirs"}.${run.unplaced > 0 ? ` ${run.unplaced} player${run.unplaced === 1 ? " has" : "s have"} no appointment: every time they picked went to a higher score.` : ""}`,
    };
  } catch (error) {
    return failed(log, "Running the ministry assignment", problem(error));
  }
}

/** Puts a player into an appointment by hand (any free one, also outside their own times), or takes their appointment away (`slot` empty). */
export async function placeMinistryEntry(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  try {
    const signup = await store.get(id);
    if (!signup) return NOT_FOUND;
    const { rounds } = await ministryRounds(new Date(), store);
    const round = rounds.find((entry) => entry.key === signup.round);
    const day = dayField(formData);
    const section = round && isScoringDay(day) ? sectionOn(round.sections, day) : null;
    if (!round || !section || !isScoringDay(day)) return { status: "error", message: "Pick one of the buff days shown. Reload the page." };
    const roster = await store.roster(round.key);
    if (!roster.available) return NO_ROSTER_TABLE;
    if (!roster.assignedAt[day]) return { status: "error", message: "This day's appointments aren't given out yet. That happens at its deadline." };

    const raw = textField(formData, "slot");
    if (raw === "") {
      await store.unplace(id, [day]);
      await record(access.user, "ministry.unplace", id, { round: round.key, day, name: signup.gameName });
      changed(formData);
      return { status: "saved", message: `${signup.gameName} has no appointment on Day ${day} now. The time is free.` };
    }
    const slot = Number(raw);
    if (signup.disabled || !joined(signup, section)) return { status: "error", message: `${signup.gameName} isn't on this day's list.` };
    const clash = /^\d{1,2}$/.test(raw) ? placementProblem(roster.appointments, day, id, slot) : "badSlot";
    if (clash === "badSlot" || slot >= SLOTS_PER_DAY) return invalid({ slot: "Pick one of the times." });
    if (clash === "slotTaken" || (await store.place(round.key, day, id, slot, "moderator")) === "slotTaken") {
      return invalid({ slot: "Another player holds that time. Take their appointment away first, or pick a free one." });
    }
    await record(access.user, "ministry.place", id, { round: round.key, day, time: slotLabel(slot), name: signup.gameName });
    log.info("Ministry appointment placed by hand", { round: round.key, day, slot });
    changed(formData);
    return { status: "saved", message: `${signup.gameName} has ${slotLabel(slot)} UTC on Day ${day}. A new run of the assignment keeps it.` };
  } catch (error) {
    return failed(log, "Placing the ministry appointment", problem(error));
  }
}

/** ▲ ▼ in the day's table: the player moves one half-hour up or down; onto a time someone holds, the two trade places. */
export async function shiftMinistryEntry(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const store = ministryStore();
  if (!store) return NO_STORE;
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  try {
    const signup = await store.get(id);
    if (!signup) return NOT_FOUND;
    const day = dayField(formData);
    if (!isScoringDay(day)) return { status: "error", message: "Pick one of the buff days shown. Reload the page." };
    const roster = await store.roster(signup.round);
    if (!roster.available) return NO_ROSTER_TABLE;
    const held = roster.appointments.find((entry) => entry.day === day && entry.signupId === id);
    if (!held) return { status: "error", message: `${signup.gameName} has no appointment on this day any more. Reload the page.` };
    const target = held.slot + (textField(formData, "direction") === "up" ? -1 : 1);
    if (target < 0 || target >= SLOTS_PER_DAY) return { status: "error", message: "That is the edge of the day." };
    const neighbour = roster.appointments.find((entry) => entry.day === day && entry.slot === target);
    let with_: string | null = null;
    if (neighbour) {
      const other = await store.get(neighbour.signupId);
      if (!(await store.swap(signup.round, day, id, neighbour.signupId))) return { status: "error", message: "The appointments changed meanwhile. Reload the page." };
      with_ = other?.gameName ?? null;
    } else if ((await store.place(signup.round, day, id, target, "moderator")) === "slotTaken") {
      return { status: "error", message: "Someone took that time a moment ago. Reload the page." };
    }
    await record(access.user, "ministry.place", id, { round: signup.round, day, time: slotLabel(target), name: signup.gameName, ...(with_ ? { swappedWith: with_ } : {}) });
    log.info("Ministry appointment moved by one", { round: signup.round, day, slot: target, swapped: neighbour !== undefined });
    changed(formData);
    return { status: "saved", message: with_ ? `${signup.gameName} and ${with_} traded places: ${signup.gameName} has ${slotLabel(target)} UTC now.` : `${signup.gameName} has ${slotLabel(target)} UTC now.` };
  } catch (error) {
    return failed(log, "Moving the ministry appointment", problem(error));
  }
}
