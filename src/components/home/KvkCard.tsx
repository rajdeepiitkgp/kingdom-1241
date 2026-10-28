import { ArrowRight, LockKeyhole, Swords } from "lucide-react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";

/** Entry point to the locked KvK page. Shows nothing from the plan itself. */
export function KvkCard({ dict, locale }: { dict: Dictionary; locale: string }) {
  return (
    <Link
      href={localePath(locale, "/kvk")}
      data-tour="home-kvk"
      className="card group relative flex items-center gap-4 overflow-hidden border-2 border-gold/60 p-5 transition-shadow hover:shadow-lift md:p-6"
    >
      <div className="pointer-events-none absolute -inset-e-10 -top-10 size-32 rounded-full bg-gold/20 blur-2xl" aria-hidden />
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gold text-on-gold shadow-[0_4px_0_0_var(--gold-strong)]" aria-hidden>
        <Swords className="size-7" />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-lg font-black text-ink">
          {dict["home.kvkCard.title"]}
          <span className="chip bg-card-soft text-ink-muted">
            <LockKeyhole className="size-3" aria-hidden /> {dict["kvk.password"]}
          </span>
        </p>
        <p className="mt-0.5 text-sm font-semibold text-ink-muted">{dict["home.kvkCard.body"]}</p>
      </div>
      <span className="btn-gold btn-sm hidden shrink-0 sm:inline-flex">
        {dict["home.kvkCard.open"]} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </span>
      <ArrowRight className="size-5 shrink-0 text-gold-strong sm:hidden rtl:rotate-180" aria-hidden />
    </Link>
  );
}
