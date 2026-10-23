"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LOCALE_COOKIE, type SiteLanguage } from "@/lib/i18n/languages";
import { switchLocaleInPath } from "@/lib/i18n/paths";

function rememberLocale(locale: string) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  } catch {
    // Cookies disabled — the URL still carries the locale.
  }
}

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
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <Languages className="pointer-events-none absolute start-3 size-4 text-primary" aria-hidden />
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value;
          rememberLocale(next);
          // Read the URL in the handler (not during render) so this component
          // never blocks prerendering of routes with dynamic params.
          router.push(switchLocaleInPath(window.location.pathname, next));
        }}
        className="h-10 max-w-[9.5rem] cursor-pointer appearance-none truncate rounded-full border border-line bg-card ps-9 pe-7 text-sm font-extrabold text-ink shadow-[0_4px_0_0_var(--line)] focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 sm:max-w-none"
        aria-label={label}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.nativeName}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute end-3 text-xs text-ink-muted" aria-hidden>
        ▾
      </span>
      {current && <span className="sr-only">{current.name}</span>}
    </label>
  );
}
