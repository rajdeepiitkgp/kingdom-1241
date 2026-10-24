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
 * Discord sign-ins carry `name` (the handle), `full_name` / `custom_claims.global_name`
 * (the display name), `provider_id` and `avatar_url` in the user metadata.
 */
export function identityFromUser(
  user: Pick<User, "id" | "email" | "user_metadata" | "app_metadata" | "identities">,
): Identity {
  const meta = (user.user_metadata ?? {}) as Meta;
  const claims = (meta.custom_claims ?? {}) as Meta;
  const discord = user.identities?.find((i) => i.provider === "discord") ?? null;
  const discordData = (discord?.identity_data ?? {}) as Meta;
  const email = normalizeEmail(user.email ?? text(meta.email));

  const provider: Identity["provider"] = discord
    ? "discord"
    : text(user.app_metadata?.provider) === "email"
      ? "email"
      : "unknown";

  const handle = discord ? normalizeHandle(text(meta.name) ?? text(meta.preferred_username) ?? text(discordData.name)) : null;
  const displayName =
    text(meta.full_name) ??
    text(claims.global_name) ??
    text(discordData.full_name) ??
    handle ??
    (email ? email.split("@")[0] : null) ??
    "Unknown";

  return {
    provider,
    displayName,
    discordId: discord ? (text(discord.id) ?? text(meta.provider_id) ?? text(meta.sub)) : null,
    discordUsername: handle,
    email,
    avatarUrl: text(meta.avatar_url) ?? text(meta.picture),
  };
}
