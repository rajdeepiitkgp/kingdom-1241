import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";
import type { SiteLanguage } from "@/lib/i18n/languages";
import { localePath } from "@/lib/i18n/paths";
import { AdminEntry } from "./AdminEntry";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { DesktopNav } from "./NavLinks";
import { TextSizeControl } from "./TextSizeControl";
import { ThemeToggle } from "./ThemeToggle";

export function Header({
  locale,
  languages,
  dict,
  kingdomName,
  kingdomNumber,
  adminHref,
}: {
  locale: string;
  languages: SiteLanguage[];
  dict: Dictionary;
  kingdomName: string;
  kingdomNumber: number;
  /** Link to the council's admin area. */
  adminHref: string;
}) {
  return (
    <header id="site-header" className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md print:hidden">
      {/* max-w-7xl, wider than the content column: the labelled nav needs the room (see DesktopNav). */}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href={localePath(locale, "/")} className="flex shrink-0 items-center gap-2.5 font-extrabold" aria-label={kingdomName}>
          <span className="grid size-10 place-items-center rounded-2xl bg-gold text-xl shadow-[0_3px_0_0_var(--gold-strong)]" aria-hidden>
            👑
          </span>
          {/* The name is hidden on phones to make room for the language, text-size and theme controls. */}
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-base text-ink" dir="auto">{kingdomName}</span>
            <span className="text-[0.6875rem] font-bold tracking-widest text-ink-faint uppercase">Kingshot · #{kingdomNumber}</span>
          </span>
        </Link>

        <DesktopNav locale={locale} dict={dict} />

        {/* min-w-0 lets the language select shrink first when text is enlarged on a phone; from lg the nav gives way instead. */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 lg:shrink-0">
          <LanguageSwitcher locale={locale} languages={languages} label={dict["lang.label"]} />
          <TextSizeControl
            labels={{
              group: dict["textSize.label"],
              smaller: dict["textSize.smaller"],
              reset: dict["textSize.reset"],
              larger: dict["textSize.larger"],
              current: dict["textSize.current"],
            }}
          />
          <ThemeToggle label={dict["theme.toggle"]} />
          <AdminEntry
            variant="header"
            href={adminHref}
            labels={{ signIn: dict["admin.signInLink"], note: dict["admin.signInNote"], panel: dict["admin.panelLink"] }}
          />
        </div>
      </div>
    </header>
  );
}
