"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LOCALE_COOKIE, type SiteLanguage } from "@/lib/i18n/languages";
import { switchLocaleInPath } from "@/lib/i18n/paths";
import { withNavigationTransition } from "@/lib/view-transition";

function rememberLocale(locale: string) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  } catch {
    // Cookies disabled — the URL still carries the locale.
  }
}

/**
 * Native <select> (so phones open their own picker and the list shows every
 * language in full) laid transparently over a compact pill. The pill shows
 * the flag and, from tablet width up, the language name — nothing to truncate
 * when text is enlarged on a phone.
 */
export function LanguageSwitcher({
  locale,
  languages,
  label,
}: {
  locale: string;
  languages: SiteLanguage[];
  label: string;
}) {
  const router = useRouter();

  // Remember the language of the page the visitor is on (also covers direct links).
  useEffect(() => {
    rememberLocale(locale);
  }, [locale]);

  const current = languages.find((l) => l.code === locale);

  return (
    <label className="relative inline-flex shrink-0 items-center rounded-full has-focus-visible:ring-4 has-focus-visible:ring-primary/40" data-tour="site-language">
      <span className="sr-only">{label}</span>
      <span
        className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm font-extrabold text-ink shadow-[0_4px_0_0_var(--line)]"
        aria-hidden
      >
        <Languages className="size-4 text-primary" />
        <span>{current?.flag ?? "🌐"}</span>
        <span className="hidden sm:inline">{current?.nativeName ?? locale}</span>
        <span className="text-xs text-ink-muted">▾</span>
      </span>
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          rememberLocale(next);
          // Read the URL in the handler (not during render) so this component
          // never blocks prerendering of routes with dynamic params.
          withNavigationTransition(() => router.push(switchLocaleInPath(window.location.pathname, next)));
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
        aria-label={label}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
