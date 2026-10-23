import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getGuides } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { localePath } from "@/lib/i18n/paths";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["guides.title"] };
}

export default async function GuidesPage() {
  const locale = await rootLocale();
  const [dict, guides] = await Promise.all([getDictionary(locale), getGuides()]);

  return (
    <div>
      <PageHeader icon="📖" title={dict["guides.title"]} subtitle={dict["guides.subtitle"]} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <li key={guide.id}>
            <Link
              href={localePath(locale, `/guides/${guide.slug}`)}
              className="card group flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5 hover:shadow-lift focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-3xl" aria-hidden>
                {guide.icon}
              </span>
              <h2 className="mt-4 text-xl font-extrabold text-ink" dir="auto">{pick(guide.title, locale)}</h2>
              <p className="mt-2 flex-1 text-sm text-ink-muted" dir="auto">{pick(guide.summary, locale)}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-primary">
                {dict["guides.read"]}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
