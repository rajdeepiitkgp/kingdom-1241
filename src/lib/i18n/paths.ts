/** Helpers for locale-prefixed URLs. */

export function localePath(locale: string, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Swap the locale prefix of a pathname (`/en/guides/kvk` → `/de/guides/kvk`). */
export function switchLocaleInPath(pathname: string, newLocale: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return `/${newLocale}`;
  segments[0] = newLocale;
  return `/${segments.join("/")}`;
}

/** The path without its locale prefix (`/en/guides/kvk` → `/guides/kvk`). */
export function stripLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return `/${segments.slice(1).join("/")}`;
}
