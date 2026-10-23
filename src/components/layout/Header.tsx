import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { SiteLanguage } from "@/lib/i18n/languages";
import { localePath } from "@/lib/i18n/paths";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { DesktopNav } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";

export function Header({
  locale,
  languages,
  dict,
  kingdomName,
  kingdomNumber,
}: {
  locale: string;
  languages: SiteLanguage[];
  dict: Dictionary;
  kingdomName: string;
  kingdomNumber: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href={localePath(locale, "/")} className="flex items-center gap-2.5 font-extrabold" aria-label={kingdomName}>
          <span className="grid size-10 place-items-center rounded-2xl bg-gold text-xl shadow-[0_3px_0_0_var(--gold-strong)]" aria-hidden>
            👑
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base text-ink">{kingdomName}</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Kingshot · #{kingdomNumber}</span>
          </span>
        </Link>

        <DesktopNav locale={locale} dict={dict} />

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} languages={languages} label={dict["lang.label"]} />
          <ThemeToggle label={dict["theme.toggle"]} />
        </div>
      </div>
    </header>
  );
}
