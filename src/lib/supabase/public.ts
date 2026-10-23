import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Read-only client for public content. Uses the publishable key, so Row Level
 * Security decides what is visible (published rows only).
 */
export function createPublicClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
