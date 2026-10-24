"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { SiteLanguage } from "@/lib/i18n/languages";

/**
 * Which language the editor's text fields show. English edits everything and
 * re-translates; any other language corrects its own text only. A dropdown
 * rather than a row of pills, so the list can grow without crowding the page.
 */
export function LanguagePicker({ languages, current, href }: { languages: SiteLanguage[]; current: string; href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label htmlFor="edit-lang" className="text-sm font-bold text-ink-muted">
        Editing texts in
      </label>
      <select
        id="edit-lang"
        className="input w-auto select-chevron py-2 text-sm font-extrabold"
        value={current}
        disabled={pending}
        aria-busy={pending}
        onChange={(event) => {
          const lang = event.target.value;
          startTransition(() => router.push(`${href}?lang=${lang}`, { scroll: false }));
        }}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.nativeName}
            {language.code === "en" ? " · source" : ""}
          </option>
        ))}
      </select>
      <span className="text-xs font-semibold text-ink-faint">
        {current === "en" ? "English is the source; every other language is translated from it." : "Corrections apply to this language only."}
      </span>
    </div>
  );
}
