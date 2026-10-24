"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeEmail, normalizeHandle } from "@/lib/auth/identity";
import { adminPath } from "@/lib/auth/paths";
import { isOwnerIdentity } from "@/lib/auth/owner";
import { GRANTABLE_ROLES, grantProblem, grantsFor, hasRole, parseRole, removeAccountProblem, roleChangeProblem, ROLES } from "@/lib/auth/roles";
import { checkAccess, type AccessDenial, type CurrentUser } from "@/lib/auth/server";
import type { Logger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField, textField, uuidField } from "./forms";

/** Server Actions of the Users page (admins only). */

const ADMINS_ONLY = "Only administrators can manage users.";
const UNKNOWN_ACCOUNT: ActionState = { status: "error", message: "Unknown account." };

function adminsOnly(reason: AccessDenial): ActionState {
  return denied(reason, ADMINS_ONLY);
}

export async function setRole(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("admin");
  if ("denied" in access) return adminsOnly(access.denied);
  const log = await actionLogger();
  const id = uuidField(formData, "id");
  if (!id) return UNKNOWN_ACCOUNT;
  const role = textField(formData, "role");
  if (!(ROLES as readonly string[]).includes(role)) return { status: "error", message: "Unknown role." };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, discord_id, discord_username, email").eq("id", id).maybeSingle();
  if (!target) return UNKNOWN_ACCOUNT;
  const problem = roleChangeProblem({
    actorIsOwner: access.user.isOwner,
    actorIsTarget: id === access.user.id,
    targetIsOwner: isOwnerIdentity({ discordId: target.discord_id ?? null, discordUsername: target.discord_username ?? null, email: target.email ?? null }),
    from: parseRole(target.role),
    to: parseRole(role),
  });
  if (problem) return { status: "error", message: problem };

  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) return failed(log, "Changing a role", error);
  await audit(access.user, "profile.role", "profiles", id, { role });
  // A demotion must stick: pre-authorisations re-apply on every sign-in, so matching ones go too.
  const from = parseRole(target.role);
  const to = parseRole(role);
  const revoked =
    to !== from && hasRole(from, to) ? await revokeGrantsFor(log, access.user, { discordUsername: target.discord_username ?? null, email: target.email ?? null }) : 0;
  revalidatePath(adminPath(localeField(formData), "/users"));
  return { status: "saved", message: revoked > 0 ? `Role updated; ${revoked} matching pre-authorisation${revoked === 1 ? "" : "s"} removed.` : "Role updated." };
}

export async function addGrant(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("admin");
  if ("denied" in access) return adminsOnly(access.denied);
  const log = await actionLogger();
  const role = parseRole(textField(formData, "role"), "moderator");
  if (!(GRANTABLE_ROLES as readonly string[]).includes(role)) return { status: "error", message: "Pick administrator or moderator." };
  const problem = grantProblem({ actorIsOwner: access.user.isOwner, role });
  if (problem) return { status: "error", message: problem };
  const discordUsername = normalizeHandle(textField(formData, "discordUsername"));
  const email = normalizeEmail(textField(formData, "email"));
  if (!discordUsername && !email) return invalid({ discordUsername: "Enter a Discord username or an e-mail." });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("role_grants")
    .insert({ role, discord_username: discordUsername, email, note: textField(formData, "note").slice(0, 200), created_by: access.user.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { status: "error", message: "That person already has a pre-authorisation." };
    return failed(log, "Adding a grant", error);
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
  const id = uuidField(formData, "id");
  if (id) {
    const log = await actionLogger();
    const { error } = await createAdminClient().from("role_grants").delete().eq("id", id);
    if (error) log.error("Deleting a grant failed", { id, error: error.message });
    else await audit(access.user, "grant.delete", "role_grants", id);
  }
  redirect(adminPath(locale, "/users"));
}

/**
 * Removes an account: the Supabase Auth user and, through the cascade, its
 * profile. The person can sign in again later, but arrives as a member with no
 * access. The owner can't be removed, nobody removes themselves, and only the
 * owner removes administrators.
 */
export async function removeAccount(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const usersPage = adminPath(locale, "/users");
  const access = await checkAccess("admin");
  if ("denied" in access) redirect(usersPage);
  const id = uuidField(formData, "id");
  if (!id) redirect(usersPage);
  const log = await actionLogger();

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, discord_id, discord_username, email, game_name").eq("id", id).maybeSingle();
  if (!target) redirect(usersPage);
  const problem = removeAccountProblem({
    actorIsOwner: access.user.isOwner,
    actorIsTarget: id === access.user.id,
    targetIsOwner: isOwnerIdentity({ discordId: target.discord_id ?? null, discordUsername: target.discord_username ?? null, email: target.email ?? null }),
    targetRole: parseRole(target.role),
  });
  if (problem) {
    log.warn("Account removal refused", { id, problem });
    redirect(`${usersPage}?error=remove`);
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    log.error("Removing an account failed", { id, error: error.message });
    redirect(`${usersPage}?error=remove`);
  }
  await revokeGrantsFor(log, access.user, { discordUsername: target.discord_username ?? null, email: target.email ?? null });
  await audit(access.user, "profile.remove", "profiles", id, {
    discordUsername: target.discord_username ?? null,
    email: target.email ?? null,
    gameName: target.game_name ?? null,
  });
  revalidatePath(usersPage);
  redirect(usersPage);
}

/** Deletes the pre-authorisations that would re-apply to this identity on its next sign-in; returns how many. */
async function revokeGrantsFor(log: Logger, actor: CurrentUser, identity: { discordUsername: string | null; email: string | null }): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("role_grants").select("id, discord_username, email");
  if (error) {
    log.error("Could not read role grants", { error: error.message });
    return 0;
  }
  const matching = grantsFor(
    (data ?? []).map((row) => ({ id: String(row.id), discordUsername: (row.discord_username as string | null) ?? null, email: (row.email as string | null) ?? null })),
    identity,
  );
  if (matching.length === 0) return 0;
  const { error: deleteError } = await admin.from("role_grants").delete().in("id", matching.map((g) => g.id));
  if (deleteError) {
    log.error("Could not revoke role grants", { error: deleteError.message });
    return 0;
  }
  await audit(actor, "grant.revoke", "role_grants", null, { count: matching.length, discordUsername: identity.discordUsername, email: identity.email });
  return matching.length;
}
