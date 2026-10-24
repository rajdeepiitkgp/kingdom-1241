import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SEED_LANGUAGES } from "@/content/seed/languages";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth/cookies";
import { ADMIN_MARKER_COOKIE, markerCookieOptions } from "@/lib/auth/session-hint";
import { loginPath } from "@/lib/auth/paths";
import { LOCALE_COOKIE } from "@/lib/i18n/languages";
import { negotiateLocale } from "@/lib/i18n/negotiate";
import { createLogger, requestId } from "@/lib/log";

const log = createLogger("proxy");

/**
 * Locale routing.
 *
 * Every page lives under `/{locale}/...`. Requests without a locale prefix
 * (`/`, `/events`, `/guides/kvk`) are redirected to the visitor's best
 * language, chosen from the saved cookie, then the browser's Accept-Language,
 * then English.
 *
 * The enabled languages are read from Supabase (REST, cached in memory for a
 * few minutes) and fall back to the seed list when Supabase isn't configured.
 */

const LIST_TTL_MS = 5 * 60 * 1000;
let cachedLocales: { codes: string[]; fetchedAt: number } | null = null;

async function getEnabledLocales(): Promise<string[]> {
  const now = Date.now();
  if (cachedLocales && now - cachedLocales.fetchedAt < LIST_TTL_MS) return cachedLocales.codes;

  const fallback = SEED_LANGUAGES.filter((l) => l.enabled).map((l) => l.code);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cachedLocales = { codes: fallback, fetchedAt: now };
    return fallback;
  }

  try {
    const res = await fetch(`${url}/rest/v1/languages?select=code&enabled=is.true&order=sort_order.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`languages request failed: ${res.status}`);
    const rows = (await res.json()) as Array<{ code: string }>;
    const codes = rows.map((r) => r.code).filter((c) => typeof c === "string" && c.length > 0);
    const result = codes.length > 0 ? codes : fallback;
    cachedLocales = { codes: result, fetchedAt: now };
    return result;
  } catch (error) {
    log.warn("Could not load languages from Supabase, using seed list", { error });
    cachedLocales = { codes: fallback, fetchedAt: now };
    return fallback;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const locales = await getEnabledLocales();

  // One id per request, forwarded to the page/action and echoed back, so a
  // player's screenshot of an error can be matched with the server log.
  const reqId = requestId(request);
  const forwarded = new Headers(request.headers);
  forwarded.set("x-request-id", reqId);

  const first = segments[0];
  if (first && locales.some((l) => l === first)) {
    // Admin pages read the session on the server, and Server Components can't
    // write cookies, so expired tokens are refreshed here. Public pages skip it.
    const response =
      segments[1] === "admin"
        ? await withFreshSession(request, reqId, pathname)
        : NextResponse.next({ request: { headers: forwarded } });
    response.headers.set("x-request-id", reqId);
    return response;
  }

  // A locale that differs only in case (e.g. /EN) → canonical spelling.
  if (first) {
    const canonical = locales.find((l) => l.toLowerCase() === first.toLowerCase());
    if (canonical) {
      const url = request.nextUrl.clone();
      url.pathname = `/${canonical}/${segments.slice(1).join("/")}`.replace(/\/$/, "");
      return NextResponse.redirect(url, 308);
    }
  }

  const locale = negotiateLocale(
    locales,
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url, 307);
}

/**
 * Admin requests: lets @supabase/ssr refresh the session (it reads the request
 * cookies and, after a token refresh, writes the new ones to both the forwarded
 * request and the response), sends signed-out visitors to the login page before
 * any admin page renders (Next renders pages in parallel with their layouts, so
 * a layout alone can't keep page data out of the response), and forwards the
 * current path (`x-pathname`) so the gate can return the visitor after login.
 */
async function withFreshSession(request: NextRequest, reqId: string, pathname: string): Promise<NextResponse> {
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-request-id", reqId);
    headers.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = next();
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });
  let signedIn = false;
  try {
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } catch (error) {
    log.warn("Could not refresh the admin session", { reqId, error });
  }

  // The marker cookie tells the (static, cached) site chrome whether someone is signed in.
  const marked = request.cookies.get(ADMIN_MARKER_COOKIE)?.value === "1";
  const [locale, , third] = pathname.split("/").filter(Boolean);
  if (!signedIn && third !== "login") {
    const url = request.nextUrl.clone();
    url.pathname = loginPath(locale);
    url.search = `?next=${encodeURIComponent(pathname)}`;
    const redirect = NextResponse.redirect(url, 307);
    if (marked) redirect.cookies.delete(ADMIN_MARKER_COOKIE);
    return redirect;
  }
  if (signedIn && !marked) response.cookies.set(ADMIN_MARKER_COOKIE, "1", markerCookieOptions(process.env.NODE_ENV === "production"));
  if (!signedIn && marked) response.cookies.delete(ADMIN_MARKER_COOKIE);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, API + auth routes, metadata files and static assets.
    "/((?!api|auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|icon\\.|apple-icon\\.|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
