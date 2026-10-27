"use server";

import { revalidatePath } from "next/cache";
import { adminPath, safeNextPath } from "@/lib/auth/paths";
import { isAdminPath } from "@/lib/auth/session-hint";
import { stripLocale } from "@/lib/i18n/paths";
import { checkAccess } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { textField } from "./forms";
import { formatGameName, gameNameTaken, parseProfileForm } from "./profile";

/**
 * Editors set their own in-game name and home alliance (shown as "[TAG] Name" in
 * the user list and on their audit entries). Only editors see the form, and
 * only they may post it: anyone with a Discord account can sign in as a member,
 * and each save writes an audit entry under a name of their choosing.
 */
export async function saveProfile(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const admin = createAdminClient();
  const [{ data: alliances }, { data: named, error: namesError }] = await Promise.all([
    admin.from("alliances").select("tag"),
    admin.from("profiles").select("id, game_name").not("game_name", "is", null),
  ]);
  if (namesError) return failed(log, "Reading profiles", namesError);
  const parsed = parseProfileForm(formData, (alliances ?? []).map((a) => String(a.tag)));
  if (!parsed.ok) return invalid(parsed.errors, parsed.errors.gameName);
  const { gameName, allianceTag } = parsed.value;

  if (gameName === access.user.gameName && allianceTag === access.user.allianceTag) {
    return { status: "saved", message: "Nothing changed." };
  }
  // The audit log shows the name only, so two accounts must never share one.
  if (gameNameTaken(gameName, access.user.id, named ?? [])) {
    const message = "Another account already uses this in-game name.";
    return invalid({ gameName: message }, message);
  }

  const { error } = await admin.from("profiles").update({ game_name: gameName, alliance_tag: allianceTag }).eq("id", access.user.id);
  if (error) return failed(log, "Saving the profile", error);
  await audit({ ...access.user, gameName, allianceTag }, "profile.update", "profiles", access.user.id, { gameName, allianceTag });
  // Only admin pages show the profile; anything else would be a free cache-busting lever.
  const path = safeNextPath(textField(formData, "path"), adminPath("en"));
  revalidatePath(isAdminPath(stripLocale(path)) ? path : adminPath("en"));
  return { status: "saved", message: `Saved. Your changes are now logged as ${formatGameName(gameName, allianceTag)}.` };
}
