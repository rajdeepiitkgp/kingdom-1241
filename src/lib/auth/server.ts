import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { createLogger } from "@/lib/log";
import { SESSION_COOKIE_OPTIONS } from "./cookies";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";
import { identityFromUser, type Identity } from "./identity";
import { isOwnerIdentity } from "./owner";
import { adminPath, loginPath } from "./paths";
import { hasRole, higherRole, parseRole, type Role } from "./roles";

/**
 * Server-side session handling for the admin area.
 *
 * The session lives in HttpOnly cookies managed by @supabase/ssr. Server
 * Components can read them but not write them, so token refreshes happen in
 * proxy.ts for `/{locale}/admin` requests; Server Actions and Route Handlers
 * may write cookies and use the same client.
 *
 * Everything here reads the request (`cookies()`), so callers must sit behind
 * a Suspense boundary or run inside an action / route handler.
 */

export interface CurrentUser extends Identity {
  id: string;
  role: Role;
  /** Matches SITE_OWNER: always an administrator, and the only one who appoints administrators. */
  isOwner: boolean;
  /** The name they use in Kingshot, set by themselves; null until they do. */
  gameName: string | null;
  /** Their home alliance (`alliances.tag`), set by themselves; shown as "[TAG] Name". */
  allianceTag: string | null;
}

const log = createLogger("auth");

/** Supabase client bound to the visitor's cookies (publishable key, so RLS applies). */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    // The session (access + refresh token) must never be readable by scripts; the
    // site chrome uses a separate marker cookie (session-hint.ts) instead.
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          // Server Components can't write cookies; proxy.ts refreshes the session for admin pages.
        }
      },
    },
  });
}

interface ProfileRow {
  role: string;
  display_name: string;
  avatar_url: string | null;
  game_name: string | null;
  alliance_tag: string | null;
}

/** Highest role a person is entitled to through a pre-authorisation (role_grants). */
async function grantedRole(admin: SupabaseClient, identity: Identity): Promise<Role | null> {
  const lookups: Array<Promise<Role[]>> = [];
  const fetchRoles = async (column: "discord_username" | "email", value: string): Promise<Role[]> => {
    const { data, error } = await admin.from("role_grants").select("role").eq(column, value);
    if (error) {
      log.error("Could not read role grants", { column, error: error.message });
      return [];
    }
    return (data ?? []).map((row) => parseRole(row.role));
  };
  if (identity.discordUsername) lookups.push(fetchRoles("discord_username", identity.discordUsername));
  if (identity.email) lookups.push(fetchRoles("email", identity.email));
  const roles = (await Promise.all(lookups)).flat();
  return roles.reduce<Role | null>((best, role) => (best ? higherRole(best, role) : role), null);
}

/**
 * Creates or refreshes the profile row of a signed-in account and returns the
 * resulting user. Pre-authorisations can only raise a role, never lower one an
 * admin set by hand; the configured owner is always an administrator.
 */
export async function syncProfile(user: User, options: { signedIn?: boolean } = {}): Promise<CurrentUser> {
  const identity = identityFromUser(user);
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("role, game_name, alliance_tag")
    .eq("id", user.id)
    .maybeSingle();
  const owner = isOwnerIdentity(identity);
  if (readError) {
    // Never write on top of a failed read: a database hiccup (or a deploy that
    // runs a minute ahead of its migration) must not reset anyone's role.
    log.error("Could not read profile; leaving it untouched", { userId: user.id, error: readError.message });
    return { id: user.id, role: owner ? "admin" : "member", isOwner: owner, gameName: null, allianceTag: null, ...identity };
  }

  let role = parseRole(existing?.role);
  const granted = await grantedRole(admin, identity);
  if (granted) role = higherRole(role, granted);
  if (owner) role = "admin";

  const { error } = await admin.from("profiles").upsert(
    {
      id: user.id,
      role,
      display_name: identity.displayName,
      discord_id: identity.discordId,
      discord_username: identity.discordUsername,
      email: identity.email,
      avatar_url: identity.avatarUrl,
      ...(options.signedIn ? { last_sign_in_at: new Date().toISOString() } : {}),
    },
    { onConflict: "id" },
  );
  if (error) log.error("Could not save profile", { userId: user.id, error: error.message });
  if (!existing || parseRole(existing.role) !== role) log.info("Profile role set", { userId: user.id, role });

  return {
    id: user.id,
    role,
    isOwner: owner,
    gameName: typeof existing?.game_name === "string" ? existing.game_name : null,
    allianceTag: typeof existing?.alliance_tag === "string" ? existing.alliance_tag : null,
    ...identity,
  };
}

/**
 * The signed-in account (if any) with its role. Cached per request, so the
 * layout gate, the page and its actions share one lookup.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // A session only exists for a real request; this also tells Next's prerender
  // that everything below (including timestamps) is request-time work.
  await connection();
  if (!isSupabaseAdminConfigured()) return null;
  const supabase = await createSessionClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null; // no session is the normal case for visitors

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, display_name, avatar_url, game_name, alliance_tag")
    .eq("id", data.user.id)
    .maybeSingle<ProfileRow>();
  if (!profile) return syncProfile(data.user, { signedIn: true });

  const identity = identityFromUser(data.user);
  const owner = isOwnerIdentity(identity);
  return {
    id: data.user.id,
    role: owner ? "admin" : parseRole(profile.role),
    isOwner: owner,
    gameName: profile.game_name,
    allianceTag: profile.alliance_tag,
    ...identity,
    displayName: profile.display_name || identity.displayName,
    avatarUrl: profile.avatar_url ?? identity.avatarUrl,
  };
});

export type AccessDenial = "signed_out" | "forbidden";

/** For Server Actions: the user with at least `required` role, or why not. */
export async function checkAccess(required: Role): Promise<{ user: CurrentUser } | { denied: AccessDenial }> {
  const user = await getCurrentUser();
  if (!user) return { denied: "signed_out" };
  if (!hasRole(user.role, required)) return { denied: "forbidden" };
  return { user };
}

/**
 * Page-level gate. Next renders a page in parallel with its layouts, so a
 * layout alone cannot keep page data out of the response: every admin page
 * calls this first and renders nothing without a signed-in editor (the admin
 * loaders check again). Signed-out visitors are sent to the login page.
 */
export async function requireEditor(locale: string, required: Role = "moderator"): Promise<CurrentUser | null> {
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);
  if (!user) redirect(loginPath(locale, requestHeaders.get("x-pathname") ?? adminPath(locale)));
  return hasRole(user.role, required) ? user : null;
}
