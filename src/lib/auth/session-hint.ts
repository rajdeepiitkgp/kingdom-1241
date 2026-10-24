/**
 * Client-side hint of "is someone signed in?" for the site chrome. The header
 * and footer are part of the cached static shell, so they can't ask the
 * server; instead the browser checks whether the Supabase session cookie is
 * present (it is readable: @supabase/ssr sets it without HttpOnly so the
 * browser client can use it). It is a hint for the chrome only, never an
 * access check: the admin pages verify the session on the server.
 */

const SESSION_COOKIE = /^sb-[a-z0-9-]+-auth-token(\.\d+)?$/;

/** True when a `document.cookie` string carries a Supabase session cookie (chunked or not). */
export function hasSessionCookie(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .map((part) => part.trim().split("=")[0] ?? "")
    .some((name) => SESSION_COOKIE.test(name));
}

/** `/admin` and everything below it (pathname without the locale prefix). */
export function isAdminPath(pathWithoutLocale: string): boolean {
  return pathWithoutLocale === "/admin" || pathWithoutLocale.startsWith("/admin/");
}
