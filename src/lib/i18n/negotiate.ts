import { DEFAULT_LOCALE } from "./languages";

/**
 * Pick the best locale for a visitor from the enabled locales.
 * Priority: saved cookie → Accept-Language header → default (English, or the
 * first enabled locale if English is disabled).
 */
export function negotiateLocale(
  enabled: readonly string[],
  cookieLocale: string | null | undefined,
  acceptLanguage: string | null | undefined,
): string {
  if (enabled.length === 0) return DEFAULT_LOCALE;

  const exact = (code: string) => enabled.find((l) => l.toLowerCase() === code.toLowerCase());
  const byBase = (code: string) => {
    const base = code.toLowerCase().split("-")[0];
    return enabled.find((l) => l.toLowerCase().split("-")[0] === base);
  };

  if (cookieLocale) {
    const match = exact(cookieLocale);
    if (match) return match;
  }

  for (const tag of parseAcceptLanguage(acceptLanguage)) {
    const match = exact(tag) ?? byBase(tag);
    if (match) return match;
  }

  return exact(DEFAULT_LOCALE) ?? enabled[0];
}

/** Parse an Accept-Language header into language tags, best first. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const [k, v] = p.trim().split("=");
        if (k === "q") {
          const parsed = Number(v);
          q = Number.isFinite(parsed) ? parsed : 0;
        }
      }
      return { tag: tag.trim(), q, index };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
    .map((entry) => entry.tag);
}
