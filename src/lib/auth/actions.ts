"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createLogger, requestId } from "@/lib/log";
import { devLoginEnabled } from "./dev-login";
import { adminPath, loginPath, safeNextPath } from "./paths";
import { createSessionClient, syncProfile } from "./server";

/**
 * Sign-in / sign-out Server Actions. Like every Server Function these can be
 * called by a direct POST, so every check lives here, never in the browser.
 */

const log = createLogger("auth");

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

function localeOf(formData: FormData): string {
  const value = String(formData.get("locale") ?? "");
  return /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(value) ? value : "en";
}

/** Starts the Discord OAuth flow; Supabase sends the visitor back to /auth/callback. */
export async function signInWithDiscord(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const next = safeNextPath(String(formData.get("next") ?? ""), adminPath(locale));
  const supabase = await createSessionClient();
  if (!supabase) redirect(`${loginPath(locale)}?error=config`);

  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    log.error("Discord sign-in could not start", { reqId: requestId(await headers()), error: error?.message });
    redirect(`${loginPath(locale)}?error=oauth`);
  }
  redirect(data.url);
}

export interface DevLoginState {
  error?: string;
  /** Set on success: the form does a full page load there (a client-side redirect could reuse a signed-out prefetch). */
  next?: string;
}

/** Local development only (see dev-login.ts). */
export async function signInWithPassword(_previous: DevLoginState, formData: FormData): Promise<DevLoginState> {
  if (!devLoginEnabled()) return { error: "The e-mail login only exists in local development." };
  const locale = localeOf(formData);
  const next = safeNextPath(String(formData.get("next") ?? ""), adminPath(locale));
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter the e-mail and the password." };

  const supabase = await createSessionClient();
  if (!supabase) return { error: "Supabase is not configured (see SETUP.md)." };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    log.info("Dev login failed", { reqId: requestId(await headers()) });
    return { error: "Wrong e-mail or password." };
  }
  await syncProfile(data.user, { signedIn: true });
  return { next };
}

export async function signOut(formData: FormData): Promise<void> {
  const locale = localeOf(formData);
  const supabase = await createSessionClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) log.warn("Sign-out reported an error", { error: error.message });
  }
  redirect(`/${locale}`);
}
