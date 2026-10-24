import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceKey, supabaseUrl } from "./env";

/**
 * Server-only client with the secret key. Bypasses RLS — used by the seed
 * script, the translation pipeline and the admin actions.
 * Never import this from a Client Component (tests/architecture guards it).
 *
 * One client per process: it keeps no session (`persistSession: false`), so
 * sharing it between requests is safe, and an action that touches five tables
 * no longer builds five clients.
 */
let cached: { key: string; client: SupabaseClient } | null = null;

export function createAdminClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseServiceKey();
  if (!url || !key) {
    throw new Error(
      "Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (see SETUP.md).",
    );
  }
  const cacheKey = `${url}\u0000${key}`;
  if (cached?.key !== cacheKey) {
    cached = { key: cacheKey, client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) };
  }
  return cached.client;
}
