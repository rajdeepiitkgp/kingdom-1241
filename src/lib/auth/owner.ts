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
  discordUsername: string | null;
  email: string | null;
}

export function parseOwner(value: string | null | undefined): OwnerIdentity | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  if (raw.includes("@") && !raw.startsWith("@")) {
    const email = normalizeEmail(raw);
    return email ? { discordUsername: null, email } : null;
  }
  const handle = normalizeHandle(raw);
  return handle ? { discordUsername: handle, email: null } : null;
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
  return owners.some((candidate) =>
    candidate.discordUsername ? identity.discordUsername === candidate.discordUsername : Boolean(candidate.email) && identity.email === candidate.email,
  );
}
