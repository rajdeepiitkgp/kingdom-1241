// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use server";

import { revalidatePath } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess, type CurrentUser } from "@/lib/auth/server";
import { getAlliances } from "@/lib/data";
import { FIELD, parseSignupForm, type SignupErrorCode } from "@/lib/ministry/form";
import { CLOSED_ROUND, MAX_SIGNUPS_PER_ROUND, parseRoundSettingsForm, withRoundSettings } from "@/lib/ministry/ministry";
import { ministryRounds } from "@/lib/ministry/state";
import { ministryMemory, ministryStore } from "@/lib/ministry/store";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { type FieldErrors, localeField, textField, uuidField } from "./forms";

/**
 * Server Actions of the admin ministry page (moderators and up): open a
 * round's sign-ups and set each buff day's deadline; add an entry by hand,
 * change one, set it aside or remove it. A moderator's change is not bound by
 * the deadlines or by the browser that made the entry. Every one is audited
 * (never with a Governor ID).
 */

const NO_STORE: ActionState = { status: "error", message: "The ministry sign-ups need the database (migration 0026)." };
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
    await store.saveSettings(withRoundSettings(stored, round, settings, rounds[0].key));
    await record(access.user, "ministry.round", null, { round, before, after: settings });
    log.info("Ministry round saved", { round, open: settings.open });
    changed(formData);
    return { status: "saved", message: settings.open ? "Saved. Players with the battle plan unlocked can sign up for this round now." : "Saved. Sign-ups for this round are closed." };
  } catch (error) {
    return failed(log, "Saving the ministry round", problem(error));
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
      await record(access.user, "ministry.signup_edit", existing.id, { round: round.key, name: entry.gameName, before: { amounts: existing.amounts, slots: existing.slots }, after: { amounts: entry.amounts, slots: entry.slots } });
      changed(formData);
      return { status: "saved", message: `Saved ${entry.gameName}.` };
    }
    if ((await store.count(round.key)) >= MAX_SIGNUPS_PER_ROUND) return { status: "error", message: `The round has ${MAX_SIGNUPS_PER_ROUND} sign-ups, the most it takes. Remove one first.` };
    const saved = await store.insert({
      round: round.key,
      governorId: entry.governorId,
      gameName: entry.gameName,
      allianceTag: entry.allianceTag,
      verified: false,
      power: null,
      amounts: entry.amounts,
      slots: entry.slots,
      locale: "en",
      deviceHash: null,
    });
    if (saved === "duplicate") return invalid({ [FIELD.governorId]: "That Governor ID is signed up already. Change its entry in the list." });
    await record(access.user, "ministry.signup_add", saved.id, { round: round.key, name: entry.gameName });
    changed(formData);
    return { status: "saved", message: `${entry.gameName} is on the list.` };
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
    await record(access.user, disabled ? "ministry.signup_disable" : "ministry.signup_enable", id, { round: saved.round, name: saved.gameName });
    changed(formData);
    return { status: "saved", message: disabled ? `${saved.gameName} is set aside: kept, but left out of the lists.` : `${saved.gameName} is back on the lists.` };
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
