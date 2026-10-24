/**
 * Attributes of the Supabase session cookies (access + refresh token), shared
 * by the request-scoped client and the proxy. HttpOnly: scripts must never
 * read a session; the site chrome relies on the marker cookie instead
 * (session-hint.ts). No Next.js imports here: proxy.ts loads this too.
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
};
