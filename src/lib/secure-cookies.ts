/**
 * Whether the battle-page and Rally Sync cookies carry the Secure flag: in
 * every production build, except on the browser tests' local server
 * (`E2E_HTTP_COOKIES=1`, plain http://localhost), where WebKit refuses a
 * Secure cookie. Vercel never honours the switch, so the live site can't lose
 * the flag.
 */
export function secureCookies(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  return !(env.E2E_HTTP_COOKIES === "1" && !env.VERCEL);
}
