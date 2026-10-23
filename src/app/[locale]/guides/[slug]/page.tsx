import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { RichText } from "@/components/content/RichText";
import { EventList } from "@/components/events/EventList";
import { getEvents, getGuideBySlug, getGuides } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { localePath } from "@/lib/i18n/paths";

export async function generateStaticParams() {
  const guides = await getGuides();
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/guides/[slug]">): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, rootLocale()]);
  const guide = await getGuideBySlug(slug);
  if (!guide) return {};
  return { title: pick(guide.title, locale), description: pick(guide.summary, locale) };
}

export default function GuidePage(props: PageProps<"/[locale]/guides/[slug]">) {
  return (
    <Suspense fallback={<GuideSkeleton />}>
      <GuideArticle params={props.params} />
    </Suspense>
  );
}

async function GuideArticle({ params }: Pick<PageProps<"/[locale]/guides/[slug]">, "params">) {
  const [{ slug }, locale] = await Promise.all([params, rootLocale()]);
  const [dict, guide, events] = await Promise.all([getDictionary(locale), getGuideBySlug(slug), getEvents()]);
  if (!guide || !guide.published) notFound();

  const relatedEvents = events.filter((e) => e.guideSlug === guide.slug);
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(guide.updatedAt),
  );

  return (
    <article className="mx-auto max-w-3xl">
      <Link href={localePath(locale, "/guides")} className="btn-ghost btn-sm mb-5">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {dict["guides.back"]}
      </Link>

      <header className="card p-6 md:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gold text-4xl shadow-[0_3px_0_0_var(--gold-strong)]" aria-hidden>
            {guide.icon}
          </span>
          <div>
            <h1 className="text-2xl font-black text-ink md:text-4xl" dir="auto">{pick(guide.title, locale)}</h1>
            <p className="mt-1 text-xs font-bold text-ink-faint">
              {dict["guides.updated"]}: <time dateTime={guide.updatedAt}>{updated}</time>
            </p>
          </div>
        </div>
        {pick(guide.summary, locale) && <p className="mt-4 text-base font-semibold text-ink-muted" dir="auto">{pick(guide.summary, locale)}</p>}
      </header>

      {relatedEvents.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold tracking-wider text-ink-muted uppercase">{dict["guides.relatedEvent"]}</h2>
          <EventList events={relatedEvents} dict={dict} locale={locale} compact />
        </section>
      )}

      <div className="card mt-5 p-6 md:p-8">
        <RichText html={pick(guide.body, locale)} />
      </div>
    </article>
  );
}

function GuideSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-5" aria-hidden>
      <div className="h-9 w-28 rounded-xl bg-card-soft" />
      <div className="card h-40 bg-card-soft" />
      <div className="card h-96 bg-card-soft" />
    </div>
  );
}
