import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { prepareRichText, RichText } from "@/components/content/RichText";
import { EventList } from "@/components/events/EventList";
import { GuideAllianceTabs } from "@/components/guides/GuideAllianceTabs";
import { allianceLabel, orderByAlliance } from "@/lib/content/guide-sections";
import { getAlliances, getEvents, getGuideBySlug, getGuides, getGuideSections } from "@/lib/data";
import type { Alliance, GuideSection } from "@/lib/data/types";
import { eventView } from "@/lib/events/view";
import type { Dictionary } from "@/lib/i18n/dictionary";
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
  const [dict, guide, events, sections, alliances] = await Promise.all([getDictionary(locale), getGuideBySlug(slug), getEvents(), getGuideSections(), getAlliances()]);
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
          <EventList events={relatedEvents.map((event) => eventView(event, locale))} dict={dict} locale={locale} compact />
        </section>
      )}

      <div className="card mt-5 p-6 md:p-8">
        <RichText html={pick(guide.body, locale)} />
      </div>

      <AllianceTabs guideId={guide.id} sections={sections} alliances={alliances} locale={locale} dict={dict} />
    </article>
  );
}

/**
 * The alliances' own sections as tabs under the shared text. The tabs are a
 * Client Component, so each section is sanitised here and only this
 * language's text (and its three labels, not the dictionary) goes to the browser.
 */
function AllianceTabs({ guideId, sections, alliances, locale, dict }: { guideId: string; sections: GuideSection[]; alliances: Alliance[]; locale: string; dict: Dictionary }) {
  const names = new Map(alliances.map((alliance) => [alliance.tag, alliance.name]));
  const tabs = orderByAlliance(
    sections.filter((section) => section.guideId === guideId && section.published),
    alliances,
  ).map((section) => ({ tag: section.allianceTag, label: allianceLabel(section.allianceTag, names.get(section.allianceTag)), html: prepareRichText(pick(section.body, locale)) }));
  const labels = { title: dict["guides.alliances.title"], hint: dict["guides.alliances.hint"], tabs: dict["guides.alliances.label"] };
  return tabs.length > 0 ? <GuideAllianceTabs tabs={tabs} labels={labels} /> : null;
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
