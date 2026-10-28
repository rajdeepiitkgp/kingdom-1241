"use server";

import { revalidatePath, updateTag } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { parseGiftCodeForm } from "@/lib/gift-codes/forms";
import { checkMessage, syncGiftCodes } from "@/lib/gift-codes/sync";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField, localizedUpdate, textField, uuidField } from "./forms";

/**
 * Server Actions of the admin gift-codes page (moderators and up): check
 * kingshot.net now, add a code by hand, write what a code gives and when it
 * expires, hide it from Home or delete it. Every one is audited and expires
 * Home's gift codes.
 */

const NO_DATABASE: ActionState = { status: "error", message: "The gift codes need the database." };
const NOT_FOUND: ActionState = { status: "error", message: "That code is no longer on the list. Reload the page." };
const CODE_TAKEN = "That code is on the list already.";

function changed(formData: FormData) {
  updateTag(CACHE_TAGS.giftCodes);
  revalidatePath(adminPath(localeField(formData), "/gift-codes"));
}

/** An empty line stores no text at all, so Home shows none (instead of an empty translation). */
function rewardsValue(existing: Localized | null | undefined, english: string): Localized {
  return english ? localizedUpdate(existing, english) : {};
}

export async function checkGiftCodesNow(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const result = await syncGiftCodes({ actor: access.user });
  if (result.status === "synced" && result.changed) changed(formData);
  else revalidatePath(adminPath(localeField(formData), "/gift-codes"));
  return { status: result.status === "synced" ? "saved" : "error", message: checkMessage(result) };
}

export async function addGiftCode(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const parsed = parseGiftCodeForm(formData, { adding: true, now: Date.now() });
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const { code, rewards, expiresAt } = parsed.value;
  const { data, error } = await createAdminClient()
    .from("gift_codes")
    .insert({ code, rewards: rewardsValue(null, rewards), expires_at: expiresAt, source: "manual" })
    .select("id")
    .single();
  if (error) return error.code === "23505" ? invalid({ code: CODE_TAKEN }) : failed(log, "Adding the gift code", error);
  await audit(access.user, "gift_code.add", "gift_codes", data.id, { code, expiresAt });
  changed(formData);
  return { status: "saved", message: `${code} is on Home. If kingshot.net lists it later, the hourly check takes it over and ends it when it stops working.` };
}

export async function saveGiftCode(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  const parsed = parseGiftCodeForm(formData, { adding: false, now: Date.now() });
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const admin = createAdminClient();
  const { data: before, error: readError } = await admin.from("gift_codes").select("code, rewards, expires_at").eq("id", id).maybeSingle();
  if (readError) return failed(log, "Reading the gift code", readError);
  if (!before) return NOT_FOUND;
  const { rewards, expiresAt } = parsed.value;
  const { error } = await admin
    .from("gift_codes")
    .update({ rewards: rewardsValue(before.rewards as Localized | null, rewards), expires_at: expiresAt })
    .eq("id", id);
  if (error) return failed(log, "Saving the gift code", error);
  await audit(access.user, "gift_code.edit", "gift_codes", id, {
    code: before.code,
    before: { rewards: (before.rewards as Localized | null)?.en ?? "", expiresAt: before.expires_at },
    after: { rewards, expiresAt },
  });
  changed(formData);
  return { status: "saved", message: "Saved. Other languages follow within a minute." };
}

export async function setGiftCodeShown(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const shown = textField(formData, "shown") === "1";
  const { data, error } = await createAdminClient().from("gift_codes").update({ active: shown }).eq("id", id).select("code");
  if (error) return failed(log, "Showing or hiding the gift code", error);
  const row = data?.[0] as { code: string } | undefined;
  if (!row) return NOT_FOUND;
  await audit(access.user, shown ? "gift_code.show" : "gift_code.hide", "gift_codes", id, { code: row.code });
  changed(formData);
  return { status: "saved", message: shown ? `${row.code} is on Home again.` : `${row.code} is hidden from Home. The hourly check leaves it hidden.` };
}

export async function deleteGiftCode(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const id = uuidField(formData, "id");
  if (!id) return NOT_FOUND;
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const admin = createAdminClient();
  const { data: row, error: readError } = await admin.from("gift_codes").select("code, source, ended_at").eq("id", id).maybeSingle();
  if (readError) return failed(log, "Reading the gift code", readError);
  if (!row) return NOT_FOUND;
  // Deleted, it would be back within the hour.
  if (row.source === "kingshot" && !row.ended_at) return { status: "error", message: `kingshot.net still lists ${row.code}, so the next check would add it again. Hide it instead.` };
  const { error } = await admin.from("gift_codes").delete().eq("id", id);
  if (error) return failed(log, "Deleting the gift code", error);
  await audit(access.user, "gift_code.delete", "gift_codes", id, { code: row.code });
  changed(formData);
  return { status: "saved", message: `${row.code} is deleted.` };
}
