import { NextResponse, type NextRequest } from "next/server";
import { SEED_LANGUAGES } from "@/content/seed/languages";
import { LOCALE_COOKIE } from "@/lib/i18n/languages";
import { negotiateLocale } from "@/lib/i18n/negotiate";

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
    console.error("[proxy] Could not load languages from Supabase, using seed list.", error);
    cachedLocales = { codes: fallback, fetchedAt: now };
    return fallback;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const locales = await getEnabledLocales();

  const first = segments[0];
  if (first && locales.some((l) => l === first)) {
    return NextResponse.next();
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

export const config = {
  matcher: [
    // Everything except Next internals, API routes, metadata files and static assets.
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|icon\\.|apple-icon\\.|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
