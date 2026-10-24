import type { User } from "@supabase/supabase-js";

/** What the site keeps about a signed-in account (mirrored into `profiles`). */
export interface Identity {
  provider: "discord" | "email" | "unknown";
  displayName: string;
  /** Stable Discord user id (null for e-mail accounts). */
  discordId: string | null;
  /** Lower-case Discord handle without '@' (null for e-mail accounts). */
  discordUsername: string | null;
  email: string | null;
  avatarUrl: string | null;
}

type Meta = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Lower-case Discord handle without a leading '@' or the legacy '#1234' / '#0' discriminator. */
export function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const handle = value.trim().replace(/^@+/, "").replace(/#\d+$/, "").trim().toLowerCase();
  return handle || null;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

/**
 * Picks the name, Discord id/handle and avatar out of a Supabase Auth user.
 *
 * Security: for Discord accounts everything comes from `identities[].identity_data`
 * (written by Supabase from Discord's answer) and the identity's provider id,
 * never from `user_metadata`. A signed-in user can rewrite `user_metadata` through
 * the Auth API at will, so a handle taken from there could impersonate the owner
 * or match somebody else's pre-authorisation. `user_metadata` is only consulted
 * for e-mail accounts' display name, which carries no rights.
 */
export function identityFromUser(
  user: Pick<User, "id" | "email" | "user_metadata" | "app_metadata" | "identities">,
): Identity {
  const meta = (user.user_metadata ?? {}) as Meta;
  const discord = user.identities?.find((i) => i.provider === "discord") ?? null;
  const discordData = (discord?.identity_data ?? {}) as Meta;
  const discordClaims = (discordData.custom_claims ?? {}) as Meta;
  const email = normalizeEmail(user.email ?? (discord ? text(discordData.email) : text(meta.email)));

  const provider: Identity["provider"] = discord
    ? "discord"
    : text(user.app_metadata?.provider) === "email"
      ? "email"
      : "unknown";

  const handle = discord ? normalizeHandle(text(discordData.name) ?? text(discordData.preferred_username)) : null;
  const displayName =
    (discord ? (text(discordClaims.global_name) ?? text(discordData.full_name)) : text(meta.full_name)) ??
    handle ??
    (email ? email.split("@")[0] : null) ??
    "Unknown";

  return {
    provider,
    displayName,
    discordId: discord ? (text(discord.id) ?? text(discordData.provider_id) ?? text(discordData.sub)) : null,
    discordUsername: handle,
    email,
    avatarUrl: discord ? (text(discordData.avatar_url) ?? text(discordData.picture)) : (text(meta.avatar_url) ?? text(meta.picture)),
  };
}
