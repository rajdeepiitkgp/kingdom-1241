/**
 * Roles of signed-in accounts. Visitors without a login see the public site
 * only. `member` is what everyone gets on first sign-in until an admin (or a
 * pre-authorisation in `role_grants`) raises them.
 */
export type Role = "admin" | "moderator" | "member";

export const ROLES: readonly Role[] = ["admin", "moderator", "member"];

/** Roles that can be handed out ahead of a first sign-in (see role_grants). */
export const GRANTABLE_ROLES: readonly Exclude<Role, "member">[] = ["admin", "moderator"];

const RANK: Record<Role, number> = { member: 0, moderator: 1, admin: 2 };

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  moderator: "Moderator",
  member: "Member (no admin access)",
};

export function parseRole(value: unknown, fallback: Role = "member"): Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value) ? (value as Role) : fallback;
}

/** `role` is at least as powerful as `required`. */
export function hasRole(role: Role, required: Role): boolean {
  return RANK[role] >= RANK[required];
}

export function higherRole(a: Role, b: Role): Role {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Content and the battle plan: moderators and admins. */
export function canEditContent(role: Role): boolean {
  return hasRole(role, "moderator");
}

/** Roles, pre-authorisations and deleting whole plans: admins only. */
export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

/** Why a role change is not allowed, or null when it is. */
export function roleChangeProblem(change: {
  actorIsOwner: boolean;
  actorIsTarget: boolean;
  targetIsOwner: boolean;
  from: Role;
  to: Role;
}): string | null {
  if (change.targetIsOwner) return "The owner is always an administrator; that can't be changed here.";
  if (change.actorIsTarget) return "You can't change your own role.";
  if ((change.to === "admin" || change.from === "admin") && !change.actorIsOwner) {
    return "Only the owner can appoint or remove administrators.";
  }
  return null;
}

/** Why a pre-authorisation can't be created, or null when it can. */
export function grantProblem(grant: { actorIsOwner: boolean; role: Role }): string | null {
  if (grant.role === "admin" && !grant.actorIsOwner) return "Only the owner can pre-authorise administrators.";
  return null;
}
