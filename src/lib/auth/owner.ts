import { normalizeEmail, normalizeHandle } from "./identity";

/**
 * The site owner is configured, not stored: `SITE_OWNER` holds the owner's
 * Discord username (or, for local development, an e-mail). Whoever signs in
 * with that identity is always an administrator, cannot be demoted by anyone,
 * and is the only person who can appoint or remove administrators. Changing
 * the owner therefore needs access to the environment (Vercel), never the UI.
 * The value may be a comma-separated list (used locally so the Discord owner
 * and the dev e-mail account are both owners); production holds one entry.
 */
export interface OwnerIdentity {
  /** Discord user id (the stable choice: handles can be changed and re-registered). */
  discordId?: string | null;
  discordUsername: string | null;
  email: string | null;
}

export function parseOwner(value: string | null | undefined): OwnerIdentity | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  if (/^\d{15,22}$/.test(raw)) return { discordId: raw, discordUsername: null, email: null };
  if (raw.includes("@") && !raw.startsWith("@")) {
    const email = normalizeEmail(raw);
    return email ? { discordId: null, discordUsername: null, email } : null;
  }
  const handle = normalizeHandle(raw);
  return handle ? { discordId: null, discordUsername: handle, email: null } : null;
}

/** Every owner configured in a comma-separated `SITE_OWNER` (normally exactly one). */
export function parseOwners(value: string | null | undefined): OwnerIdentity[] {
  return (value ?? "")
    .split(",")
    .map((entry) => parseOwner(entry))
    .filter((owner): owner is OwnerIdentity => owner !== null);
}

export function isOwnerIdentity(
  identity: OwnerIdentity,
  owner: OwnerIdentity | OwnerIdentity[] | null = parseOwners(process.env.SITE_OWNER),
): boolean {
  const owners = owner === null ? [] : Array.isArray(owner) ? owner : [owner];
  return owners.some((candidate) => {
    if (candidate.discordId) return Boolean(identity.discordId) && identity.discordId === candidate.discordId;
    if (candidate.discordUsername) return identity.discordUsername === candidate.discordUsername;
    return Boolean(candidate.email) && identity.email === candidate.email;
  });
}

export type OwnerKind = "discord_id" | "discord_handle" | "email";

/**
 * What the settings page shows of an owner entry: its kind, and the value only
 * as much as it takes to recognise it (the id's last four digits, the
 * e-mail's first letter and domain), so a screenshot carries nothing to copy.
 */
export function ownerLabel(owner: OwnerIdentity): { kind: OwnerKind; shown: string } {
  if (owner.discordId) return { kind: "discord_id", shown: `…${owner.discordId.slice(-4)}` };
  if (owner.discordUsername) return { kind: "discord_handle", shown: owner.discordUsername };
  const [local = "", domain = ""] = (owner.email ?? "").split("@");
  return { kind: "email", shown: `${local.slice(0, 1)}…@${domain}` };
}

/**
 * Why SITE_OWNER can't go to production, or null. The owner is decided when
 * the site is set up (SETUP.md, step 0), and a production build without one
 * fails rather than run a site nobody owns: exactly one entry, the Discord
 * user id (a handle can be renamed and then registered by someone else).
 */
export function productionOwnerProblem(value: string | null | undefined): string | null {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return "SITE_OWNER is not set. Set it to the owner's Discord user id in Vercel (SETUP.md, step 0).";
  if (entries.length > 1) return "SITE_OWNER holds more than one owner. Production takes exactly one: the owner's Discord user id.";
  if (!parseOwner(entries[0])?.discordId) {
    return "SITE_OWNER must be the owner's Discord user id (a 17–20 digit number from Discord → Settings → Advanced → Developer Mode → Copy User ID), not a username or e-mail.";
  }
  return null;
}
