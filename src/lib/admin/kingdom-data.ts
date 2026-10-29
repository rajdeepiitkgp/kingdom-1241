import { mapAlliance } from "@/lib/data/mappers";
import type { Alliance } from "@/lib/data/types";
import type { Localized } from "@/lib/i18n/localized";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { parseTransferTerms, type TransferTerms } from "@/lib/transfers/terms";
import { pendingColumns } from "./translation";

/**
 * Loaders of the alliance pages' and the transfer section's editors (server
 * only, uncached, service role). Callers check the role first.
 */

const log = createLogger("admin");

export interface AdminAllianceProfile extends Alliance {
  /** Columns the pipeline still has to translate. */
  pending: string[];
}

function mapProfile(row: Record<string, unknown>): AdminAllianceProfile {
  return { ...mapAlliance(row), pending: pendingColumns("alliances", row) };
}

/** Every alliance on the owner's list (hidden ones too), strongest first; null when the database can't be read. */
export async function listAllianceProfiles(): Promise<AdminAllianceProfile[] | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient()
    .from("alliances")
    .select("*")
    .order("power", { ascending: false, nullsFirst: false })
    .order("sort_order");
  if (error) {
    log.error("Reading the alliances failed", { error: error.message, code: error.code });
    return null;
  }
  return (data ?? []).map(mapProfile);
}

export async function getAllianceProfile(id: string): Promise<AdminAllianceProfile | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("alliances").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Reading an alliance failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapProfile(data) : null;
}

/** One translated transfer text and whether the machine is still translating it. */
export interface TransferText {
  value: Localized;
  pending: boolean;
}

export interface AdminTransfers {
  /** The kingdom's own Discord invite (Home and the footer). */
  discordUrl: string | null;
  open: boolean;
  terms: TransferTerms;
  info: TransferText;
  contact: TransferText;
  /** The transfers page's own invite; null = the kingdom's. */
  transferDiscordUrl: string | null;
}

/** The kingdom's Discord and the transfer section (rows of `site_settings`); null when the database can't be read. */
export async function getTransfersForEditing(defaults: { open: boolean; info: Localized; contact: Localized }): Promise<AdminTransfers | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient()
    .from("site_settings")
    .select("*")
    .in("key", ["discord_invite_url", "transfers_open", "transfer_terms", "transfer_info", "transfer_contact", "transfer_discord_url"]);
  if (error) {
    log.error("Reading the transfer settings failed", { error: error.message, code: error.code });
    return null;
  }
  const row = (key: string) => (data ?? []).find((r) => r.key === key) as Record<string, unknown> | undefined;
  const text = (key: string, fallback: Localized): TransferText => {
    const found = row(key);
    return found ? { value: (found.value ?? {}) as Localized, pending: pendingColumns("site_settings", found).length > 0 } : { value: fallback, pending: false };
  };
  const link = (key: string) => {
    const value = row(key)?.value;
    return typeof value === "string" && value ? value : null;
  };
  const open = row("transfers_open")?.value;
  return {
    discordUrl: link("discord_invite_url"),
    open: typeof open === "boolean" ? open : defaults.open,
    terms: parseTransferTerms(row("transfer_terms")?.value),
    info: text("transfer_info", defaults.info),
    contact: text("transfer_contact", defaults.contact),
    transferDiscordUrl: link("transfer_discord_url"),
  };
}
