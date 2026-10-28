import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The owner's settings (table `app_config`, migration 0016): one JSON value
 * per key, read and written with the service role from server code only;
 * visitors can't read the table. Each feature parses its own value
 * tolerantly, so a missing row or table means "the defaults".
 */

export type ConfigKey = "rally_sync_capacity" | "translation" | "password_rules" | "feedback_defaults" | "alliance_sync";

/** The stored value, or null when there is none. Errors (a missing table included) are thrown for the caller to judge. */
export async function readConfig(supabase: SupabaseClient, key: ConfigKey): Promise<unknown> {
  const { data, error } = await supabase.from("app_config").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function writeConfig(supabase: SupabaseClient, key: ConfigKey, value: unknown): Promise<void> {
  const { error } = await supabase.from("app_config").upsert({ key, value });
  if (error) throw error;
}
