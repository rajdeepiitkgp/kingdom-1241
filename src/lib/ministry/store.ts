// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { readConfig, writeConfig } from "@/lib/config/app-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { memoryMinistryStore } from "./memory-store";
import { MAX_SIGNUPS_PER_ROUND, parseAmounts, parseMinistrySettings, parseSlotChoice } from "./ministry";
import type { MinistryStore, NewSignup, SignupPatch, StoredSignup } from "./store-types";

export * from "./store-types";

/**
 * Storage of the ministry sign-ups (server only): table ministry_signups
 * (migration 0026) and the app_config value `ministry` through the service
 * role, or an in-memory store for local review and the browser tests
 * (MINISTRY_STORE=memory, never on Vercel).
 */

/** The store this deployment uses, or null when there is no database (the page then says sign-ups aren't open). */
export function ministryStore(): MinistryStore | null {
  if (ministryMemory()) return memoryMinistryStore();
  return isSupabaseAdminConfigured() ? supabaseStore(createAdminClient()) : null;
}

export const ministryMemory = (): boolean => process.env.MINISTRY_STORE === "memory" && !process.env.VERCEL;

const COLUMNS = "id, round, governor_id, game_name, alliance_tag, verified, power, amounts, slots, disabled, device_hash, locale, created_at, updated_at";
const TABLE = "ministry_signups";

type Row = Record<string, unknown>;
const text = (v: unknown) => (typeof v === "string" ? v : "");

export function mapSignupRow(row: Row): StoredSignup {
  const power = typeof row.power === "number" ? row.power : typeof row.power === "string" ? Number(row.power) : Number.NaN;
  return {
    id: text(row.id),
    round: text(row.round),
    governorId: text(row.governor_id),
    gameName: text(row.game_name),
    allianceTag: typeof row.alliance_tag === "string" && row.alliance_tag ? row.alliance_tag : null,
    verified: row.verified === true,
    power: Number.isFinite(power) && power > 0 ? power : null,
    amounts: parseAmounts(row.amounts),
    slots: parseSlotChoice(row.slots),
    disabled: row.disabled === true,
    deviceHash: typeof row.device_hash === "string" && row.device_hash ? row.device_hash : null,
    locale: text(row.locale) || "en",
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

function patchColumns(patch: SignupPatch): Row {
  const columns: Row = {};
  if (patch.gameName !== undefined) columns.game_name = patch.gameName;
  if (patch.allianceTag !== undefined) columns.alliance_tag = patch.allianceTag;
  if (patch.verified !== undefined) columns.verified = patch.verified;
  if (patch.power !== undefined) columns.power = patch.power;
  if (patch.amounts !== undefined) columns.amounts = patch.amounts;
  if (patch.slots !== undefined) columns.slots = patch.slots;
  if (patch.disabled !== undefined) columns.disabled = patch.disabled;
  if (patch.locale !== undefined) columns.locale = patch.locale;
  if (patch.deviceHash !== undefined) columns.device_hash = patch.deviceHash;
  return columns;
}

function supabaseStore(supabase: SupabaseClient): MinistryStore {
  return {
    async settings() {
      return parseMinistrySettings(await readConfig(supabase, "ministry"));
    },
    async saveSettings(value) {
      await writeConfig(supabase, "ministry", value);
    },
    async list(round) {
      // Above the cap, so a full round is read whole.
      const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("round", round).order("created_at").order("id").limit(MAX_SIGNUPS_PER_ROUND + 100);
      if (error) throw error;
      return (data ?? []).map((row) => mapSignupRow(row as Row));
    },
    async count(round) {
      const { count, error } = await supabase.from(TABLE).select("id", { count: "exact", head: true }).eq("round", round);
      if (error) throw error;
      return count ?? 0;
    },
    async get(id) {
      const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapSignupRow(data as Row) : null;
    },
    async byGovernor(round, governorId) {
      const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("round", round).eq("governor_id", governorId).maybeSingle();
      if (error) throw error;
      return data ? mapSignupRow(data as Row) : null;
    },
    async byDevice(round, deviceHash) {
      const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("round", round).eq("device_hash", deviceHash).order("created_at").limit(50);
      if (error) throw error;
      return (data ?? []).map((row) => mapSignupRow(row as Row));
    },
    async insert(row: NewSignup) {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          round: row.round,
          governor_id: row.governorId,
          game_name: row.gameName,
          alliance_tag: row.allianceTag,
          verified: row.verified,
          power: row.power,
          amounts: row.amounts,
          slots: row.slots,
          locale: row.locale,
          device_hash: row.deviceHash,
        })
        .select(COLUMNS)
        .single();
      if (error) {
        if (error.code === "23505") return "duplicate";
        throw error;
      }
      return mapSignupRow(data as Row);
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(TABLE).update(patchColumns(patch)).eq("id", id).select(COLUMNS);
      if (error) throw error;
      const row = data?.[0];
      return row ? mapSignupRow(row as Row) : null;
    },
    async remove(id) {
      const { data, error } = await supabase.from(TABLE).delete().eq("id", id).select("id");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  };
}
