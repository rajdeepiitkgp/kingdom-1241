"use server";

import { revalidatePath } from "next/cache";
import { safeNextPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { textField } from "./forms";
import { formatGameName, parseProfileForm } from "./profile";

const log = createLogger("admin");

/** Any signed-in person sets their own in-game name and home alliance (shown as "[TAG] Name" in the user list and on their audit entries). */
export async function saveProfile(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("member");
  if ("denied" in access) return { status: "error", message: "Your session has ended. Sign in again." };
  const admin = createAdminClient();
  const { data: alliances } = await admin.from("alliances").select("tag");
  const parsed = parseProfileForm(formData, (alliances ?? []).map((a) => String(a.tag)));
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: parsed.errors.gameName };
  const { gameName, allianceTag } = parsed.value;

  const { error } = await admin.from("profiles").update({ game_name: gameName, alliance_tag: allianceTag }).eq("id", access.user.id);
  if (error) {
    log.error("Saving the profile failed", { userId: access.user.id, error: error.message });
    return { status: "error", message: "Saving failed. Try again in a moment." };
  }
  await audit({ ...access.user, gameName, allianceTag }, "profile.update", "profiles", access.user.id, { gameName, allianceTag });
  revalidatePath(safeNextPath(textField(formData, "path"), "/"));
  return { status: "saved", message: `Saved. Your changes are now logged as ${formatGameName(gameName, allianceTag)}.` };
}
