/** URL helpers for the admin area (pure, unit-tested). */

export function adminPath(locale: string, sub = ""): string {
  return `/${locale}/admin${sub}`;
}

export function loginPath(locale: string, next?: string | null): string {
  const base = adminPath(locale, "/login");
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/**
 * Only a same-site relative path may be used as the destination after signing
 * in; anything else (absolute URLs, protocol-relative `//evil`, header
 * injection) falls back to the admin home.
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\s\r\n]/.test(value)) return fallback;
  return value;
}
