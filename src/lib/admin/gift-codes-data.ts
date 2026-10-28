import { checkAccess } from "@/lib/auth/server";
import { readConfig } from "@/lib/config/app-config";
import { type GiftCodeState, type GiftCodeSyncState, giftCodeState, NO_CHECK_YET, parseGiftCodeSyncState } from "@/lib/gift-codes/sync-plan";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

/** Uncached reads for the admin gift-codes page (server only, after the role check). */

const log = createLogger("admin");

export interface AdminGiftCode {
  id: string;
  code: string;
  /** The English line; the other languages come from the translation pipeline. */
  rewards: string;
  expiresAt: string | null;
  addedAt: string;
  source: "kingshot" | "manual";
  endedAt: string | null;
  state: GiftCodeState;
}

export interface GiftCodesAdmin {
  available: boolean;
  migrated: boolean;
  codes: AdminGiftCode[];
  sync: GiftCodeSyncState;
}

/** Every code, newest first, with where it stands now and the last check of kingshot.net. */
export async function listGiftCodes(): Promise<GiftCodesAdmin> {
  const none = { codes: [], sync: NO_CHECK_YET };
  const access = await checkAccess("moderator");
  if ("denied" in access) {
    log.warn("Admin data requested without access", { what: "gift codes", reason: access.denied });
    return { available: false, migrated: true, ...none };
  }
  if (!isSupabaseAdminConfigured()) return { available: false, migrated: true, ...none };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gift_codes")
    .select("id, code, rewards, expires_at, added_at, active, source, ended_at")
    .order("added_at", { ascending: false });
  if (error) {
    if (error.code === "42703") return { available: true, migrated: false, ...none };
    log.error("Could not read the gift codes", { error: error.message });
    return { available: false, migrated: true, ...none };
  }
  let sync = NO_CHECK_YET;
  try {
    sync = parseGiftCodeSyncState(await readConfig(admin, "gift_code_sync"));
  } catch (configError) {
    log.warn("Could not read the last gift-code check", { error: configError instanceof Error ? configError.message : String(configError) });
  }
  const now = Date.now();
  const codes = (data ?? []).map((row): AdminGiftCode => {
    const rewards = row.rewards && typeof row.rewards === "object" ? (row.rewards as Record<string, unknown>).en : null;
    const code = {
      id: row.id,
      code: row.code,
      rewards: typeof rewards === "string" ? rewards : "",
      expiresAt: row.expires_at ?? null,
      addedAt: row.added_at,
      source: row.source === "kingshot" ? "kingshot" : "manual",
      endedAt: row.ended_at ?? null,
      active: row.active !== false,
    } as const;
    return { ...code, state: giftCodeState(code, now) };
  });
  return { available: true, migrated: true, codes, sync };
}
