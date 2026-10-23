/** Reads Supabase configuration from the environment. */

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

/** The publishable (anon) key — safe to expose, protected by Row Level Security. */
export function supabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

/** The secret (service role) key — server only, bypasses RLS. */
export function supabaseServiceKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    undefined
  );
}

/** True when the public site can read from Supabase. */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

/** True when server-side scripts/routes can write to Supabase. */
export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}
