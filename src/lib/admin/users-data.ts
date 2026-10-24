import { isOwnerIdentity } from "@/lib/auth/owner";
import { parseRole, type Role } from "@/lib/auth/roles";
import { checkAccess } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

/** Uncached, service-role reads for the Users page. Server only, after the role check. */

const log = createLogger("admin");

export interface AdminProfile {
  id: string;
  role: Role;
  displayName: string;
  /** Self-declared in-game name (unverified: check the Discord handle next to it). */
  gameName: string | null;
  allianceTag: string | null;
  discordUsername: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  isOwner: boolean;
}

const ROLE_ORDER: Record<Role, number> = { admin: 0, moderator: 1, member: 2 };

async function allowed(what: string): Promise<boolean> {
  const access = await checkAccess("admin");
  if ("denied" in access) {
    log.warn("Admin data requested without access", { what, reason: access.denied });
    return false;
  }
  return true;
}

export async function listProfiles(): Promise<AdminProfile[]> {
  if (!(await allowed("profiles"))) return [];
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, role, display_name, game_name, alliance_tag, discord_username, email, avatar_url, last_sign_in_at, created_at");
  if (error) {
    log.error("Could not list profiles", { error: error.message });
    return [];
  }
  return (data ?? [])
    .map((row) => {
      const discordUsername = typeof row.discord_username === "string" ? row.discord_username : null;
      const email = typeof row.email === "string" ? row.email : null;
      const isOwner = isOwnerIdentity({ discordUsername, email });
      return {
        id: String(row.id),
        role: isOwner ? ("admin" as const) : parseRole(row.role),
        displayName: String(row.display_name ?? ""),
        gameName: typeof row.game_name === "string" && row.game_name ? row.game_name : null,
        allianceTag: typeof row.alliance_tag === "string" && row.alliance_tag ? row.alliance_tag : null,
        discordUsername,
        email,
        avatarUrl: typeof row.avatar_url === "string" ? row.avatar_url : null,
        lastSignInAt: typeof row.last_sign_in_at === "string" ? row.last_sign_in_at : null,
        createdAt: String(row.created_at ?? ""),
        isOwner,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isOwner) - Number(a.isOwner) ||
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        (a.gameName ?? a.displayName).localeCompare(b.gameName ?? b.displayName, "en"),
    );
}

export interface Grant {
  id: string;
  role: Role;
  discordUsername: string | null;
  email: string | null;
  note: string;
  createdAt: string;
}

export async function listGrants(): Promise<Grant[]> {
  if (!(await allowed("grants"))) return [];
  const { data, error } = await createAdminClient()
    .from("role_grants")
    .select("id, role, discord_username, email, note, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    log.error("Could not list role grants", { error: error.message });
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    role: parseRole(row.role),
    discordUsername: typeof row.discord_username === "string" ? row.discord_username : null,
    email: typeof row.email === "string" ? row.email : null,
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? ""),
  }));
}
