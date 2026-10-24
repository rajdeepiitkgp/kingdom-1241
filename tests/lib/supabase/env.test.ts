import { afterEach, describe, expect, it, vi } from "vitest";
import { isSupabaseAdminConfigured, isSupabaseConfigured, supabaseAnonKey, supabaseServiceKey, supabaseUrl } from "@/lib/supabase/env";

const VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"];

describe("Supabase environment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("treats blank values as unset", () => {
    for (const name of VARS) vi.stubEnv(name, "  ");
    expect(supabaseUrl()).toBeUndefined();
    expect(supabaseAnonKey()).toBeUndefined();
    expect(supabaseServiceKey()).toBeUndefined();
    expect(isSupabaseConfigured()).toBe(false);
    expect(isSupabaseAdminConfigured()).toBe(false);
  });

  it("prefers the new key names over the legacy ones and trims", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://x.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    expect(supabaseUrl()).toBe("https://x.supabase.co");
    expect(supabaseAnonKey()).toBe("pub");
    expect(supabaseServiceKey()).toBe("secret");
    expect(isSupabaseConfigured()).toBe(true);
    expect(isSupabaseAdminConfigured()).toBe(true);
  });

  it("falls back to the legacy names", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    expect(supabaseAnonKey()).toBe("anon");
    expect(supabaseServiceKey()).toBe("service");
  });

  it("needs the URL as well as a key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pub");
    vi.stubEnv("SUPABASE_SECRET_KEY", "secret");
    expect(isSupabaseConfigured()).toBe(false);
    expect(isSupabaseAdminConfigured()).toBe(false);
  });
});
