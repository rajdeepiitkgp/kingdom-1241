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
import { formatGameName, parseProfileForm } from "./profile";

/** Any signed-in person sets their own in-game name and home alliance (shown as "[TAG] Name" in the user list and on their audit entries). */
export async function saveProfile(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("member");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const admin = createAdminClient();
  const { data: alliances } = await admin.from("alliances").select("tag");
  const parsed = parseProfileForm(formData, (alliances ?? []).map((a) => String(a.tag)));
  if (!parsed.ok) return invalid(parsed.errors, parsed.errors.gameName);
  const { gameName, allianceTag } = parsed.value;

  const { error } = await admin.from("profiles").update({ game_name: gameName, alliance_tag: allianceTag }).eq("id", access.user.id);
  if (error) return failed(log, "Saving the profile", error);
  await audit({ ...access.user, gameName, allianceTag }, "profile.update", "profiles", access.user.id, { gameName, allianceTag });
  // Only admin pages show the profile; anything else would be a free cache-busting lever.
  const path = safeNextPath(textField(formData, "path"), adminPath("en"));
  revalidatePath(isAdminPath(stripLocale(path)) ? path : adminPath("en"));
  return { status: "saved", message: `Saved. Your changes are now logged as ${formatGameName(gameName, allianceTag)}.` };
}
