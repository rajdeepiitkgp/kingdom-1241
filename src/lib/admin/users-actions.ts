"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeEmail, normalizeHandle } from "@/lib/auth/identity";
import { adminPath } from "@/lib/auth/paths";
import { isOwnerIdentity } from "@/lib/auth/owner";
import { GRANTABLE_ROLES, grantProblem, hasRole, parseRole, roleChangeProblem, ROLES } from "@/lib/auth/roles";
import { checkAccess, type AccessDenial } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { textField } from "./forms";

/** Server Actions of the Users page (admins only). */

const log = createLogger("admin");
const UUID = /^[0-9a-f-]{36}$/i;

function denied(reason: AccessDenial): ActionState {
  return {
    status: "error",
    message: reason === "signed_out" ? "Your session has ended. Sign in again." : "Only administrators can manage users.",
  };
}

function localeField(formData: FormData): string {
  const value = textField(formData, "locale");
  return /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(value) ? value : "en";
}

export async function setRole(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("admin");
  if ("denied" in access) return denied(access.denied);
  const id = textField(formData, "id");
  if (!UUID.test(id)) return { status: "error", message: "Unknown account." };
  const role = textField(formData, "role");
  if (!(ROLES as readonly string[]).includes(role)) return { status: "error", message: "Unknown role." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, discord_username, email").eq("id", id).maybeSingle();
  if (!target) return { status: "error", message: "Unknown account." };
  const problem = roleChangeProblem({
    actorIsOwner: access.user.isOwner,
    actorIsTarget: id === access.user.id,
    targetIsOwner: isOwnerIdentity({ discordUsername: target.discord_username ?? null, email: target.email ?? null }),
    from: parseRole(target.role),
    to: parseRole(role),
  });
  if (problem) return { status: "error", message: problem };

  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) {
    log.error("Changing a role failed", { id, error: error.message });
    return { status: "error", message: "Saving failed. Try again in a moment." };
  }
  await audit(access.user, "profile.role", "profiles", id, { role });
  revalidatePath(adminPath(localeField(formData), "/users"));
  return { status: "saved", message: "Role updated." };
}

export async function addGrant(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("admin");
  if ("denied" in access) return denied(access.denied);
  const role = parseRole(textField(formData, "role"), "moderator");
  if (!(GRANTABLE_ROLES as readonly string[]).includes(role)) return { status: "error", message: "Pick administrator or moderator." };
  const problem = grantProblem({ actorIsOwner: access.user.isOwner, role });
  if (problem) return { status: "error", message: problem };
  const discordUsername = normalizeHandle(textField(formData, "discordUsername"));
  const email = normalizeEmail(textField(formData, "email"));
  if (!discordUsername && !email) {
    return { status: "error", errors: { discordUsername: "Enter a Discord username or an e-mail." }, message: "Please fix the highlighted fields." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_grants")
    .insert({ role, discord_username: discordUsername, email, note: textField(formData, "note").slice(0, 200), created_by: access.user.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { status: "error", message: "That person already has a pre-authorisation." };
    log.error("Adding a grant failed", { error: error.message });
    return { status: "error", message: "Saving failed. Try again in a moment." };
  }

  // Someone who already signed in as a member gets the role straight away.
  for (const [column, value] of [["discord_username", discordUsername], ["email", email]] as const) {
    if (!value) continue;
    const { data: profiles } = await admin.from("profiles").select("id, role").eq(column, value);
    for (const profile of profiles ?? []) {
      if (!hasRole(parseRole(profile.role), role)) await admin.from("profiles").update({ role }).eq("id", profile.id);
    }
  }

  await audit(access.user, "grant.create", "role_grants", String(data.id), { role, discordUsername, email });
  revalidatePath(adminPath(localeField(formData), "/users"));
  return { status: "saved", message: "Pre-authorisation added." };
}

export async function deleteGrant(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("admin");
  if ("denied" in access) redirect(adminPath(locale, "/users"));
  const id = textField(formData, "id");
  if (UUID.test(id)) {
    const { error } = await createAdminClient().from("role_grants").delete().eq("id", id);
    if (error) log.error("Deleting a grant failed", { id, error: error.message });
    else await audit(access.user, "grant.delete", "role_grants", id);
  }
  redirect(adminPath(locale, "/users"));
}
