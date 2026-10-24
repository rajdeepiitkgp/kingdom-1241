/**
 * Client-side hint of "is someone signed in?" for the site chrome. The header
 * and footer are part of the cached static shell, so they can't ask the
 * server. The Supabase session cookies are HttpOnly (the browser must never
 * read them), so the server sets a separate, harmless marker cookie next to
 * them: present while a session exists, removed on sign-out. It is a hint for
 * the chrome only, never an access check: the admin pages verify the session.
 */

export const ADMIN_MARKER_COOKIE = "kd1241_admin";

/** True when a `document.cookie` string carries the marker. */
export function hasSessionMarker(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${ADMIN_MARKER_COOKIE}=1`);
}

/** Attributes of the marker cookie (not HttpOnly on purpose: the chrome reads it). */
export function markerCookieOptions(secure: boolean) {
  return { httpOnly: false, secure, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 400 };
}

/** `/admin` and everything below it (pathname without the locale prefix). */
export function isAdminPath(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");
}
