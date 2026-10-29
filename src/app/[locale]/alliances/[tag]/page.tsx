import clsx from "clsx";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { type ReactNode, Suspense } from "react";
import { AllianceGuideLink } from "@/components/guides/AllianceGuideLink";
import { formatPower, RANK_STYLES } from "@/components/home/AllianceGrid";
import { PageGuide } from "@/components/tour/PageGuide";
import { guidesOfAlliance, tagFromSegment } from "@/lib/alliances/pages";
import { getAlliances, getGuides, getGuideSections } from "@/lib/data";
import { format } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { localePath } from "@/lib/i18n/paths";
import { ALLIANCE_TOUR } from "@/lib/tour/alliance";

type Props = PageProps<"/[locale]/alliances/[tag]">;

export async function generateStaticParams() {
  const alliances = await getAlliances();
  return alliances.map((alliance) => ({ tag: alliance.tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const alliance = (await getAlliances()).find((a) => a.tag === tagFromSegment(tag));
  return alliance ? { title: `[${alliance.tag}] ${alliance.name}` } : {};
}

export default function AlliancePage(props: Props) {
  return (
    <Suspense fallback={<AllianceSkeleton />}>
      <AllianceArticle params={props.params} />
    </Suspense>
  );
}

/**
 * One alliance of the kingdom: the numbers MightPulse keeps current every
 * day, what its leaders say about it (written by the council in the admin
 * area) and the guides where it plays an event its own way.
 */
async function AllianceArticle({ params }: Pick<Props, "params">) {
  const [{ tag: segment }, locale] = await Promise.all([params, rootLocale()]);
  const [dict, alliances, guides, sections] = await Promise.all([getDictionary(locale), getAlliances(), getGuides(), getGuideSections()]);
  const tag = tagFromSegment(segment);
  const index = alliances.findIndex((a) => a.tag === tag);
  if (index < 0) notFound();
  const alliance = alliances[index];
  const description = pick(alliance.description, locale);
  const requirements = pick(alliance.requirements, locale);
  const ownGuides = guidesOfAlliance(alliance.tag, guides, sections);
  return (
    <article className="mx-auto max-w-3xl">
      <Link href={localePath(locale, "/")} className="btn-ghost btn-sm mb-5">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {dict["nav.home"]}
      </Link>

      <header className="card p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="grid size-16 shrink-0 place-items-center rounded-2xl text-base font-black text-white shadow-[0_3px_0_0_rgba(0,0,0,0.18)]"
            style={{ backgroundColor: alliance.color }}
            dir="ltr"
            aria-hidden
          >
            {alliance.tag}
          </span>
          {/* On a phone the name gets a line of its own under the badge and the guide's "?". */}
          <div className="order-last min-w-0 grow basis-full sm:order-0 sm:basis-0">
            <h1 className="text-2xl font-black wrap-break-word text-ink md:text-4xl" dir="ltr">
              [{alliance.tag}] {alliance.name}
            </h1>
            {alliance.languages && (
              <p className="mt-1 text-sm font-semibold text-ink-muted">
                {dict["alliance.languages"]}: <span className="font-bold text-ink">{alliance.languages}</span>
              </p>
            )}
          </div>
          <div className="ms-auto">
            <PageGuide tour={ALLIANCE_TOUR} dict={dict} />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-tour="alliance-stats">
          <Stat label={dict["alliance.rank"]}>
            <span className={clsx("grid size-7 place-items-center rounded-full text-xs font-black", RANK_STYLES[index] ?? "bg-card text-ink-muted")}>{index + 1}</span>
          </Stat>
          {alliance.power != null && (
            <Stat label={dict["alliance.power"]} title={alliance.power.toLocaleString("en-US")}>
              {formatPower(alliance.power, locale)}
            </Stat>
          )}
          {alliance.members != null && (
            <Stat label={dict["alliance.members"]} icon={<Users className="size-3" aria-hidden />}>
              {alliance.members} / {alliance.maxMembers}
            </Stat>
          )}
          {alliance.leader && (
            <Stat label={dict["alliance.leader"]}>
              <span dir="auto">{alliance.leader}</span>
            </Stat>
          )}
        </dl>
        <p className="mt-3 text-xs font-semibold text-ink-faint">{dict["alliance.source"]}</p>
      </header>

      {(description || requirements) && (
        <section className="card mt-5 space-y-4 p-6 md:p-8" data-tour="alliance-about" aria-labelledby="alliance-about">
          <h2 id="alliance-about" className="text-xl font-black text-ink">
            {dict["alliance.about"]}
          </h2>
          {description && (
            <p className="text-base whitespace-pre-line text-ink" dir="auto">
              {description}
            </p>
          )}
          {requirements && (
            <div className="rounded-2xl bg-card-soft p-4">
              <h3 className="text-sm font-black text-ink-muted">{dict["alliance.requirements"]}</h3>
              <p className="mt-1 whitespace-pre-line text-ink" dir="auto">
                {requirements}
              </p>
            </div>
          )}
        </section>
      )}

      {alliance.discordUrl && (
        <a
          href={alliance.discordUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-5"
          data-tour="alliance-discord"
        >
          Discord <ExternalLink className="size-4" aria-hidden />
        </a>
      )}

      {ownGuides.length > 0 && (
        <section className="card mt-5 p-6 md:p-8" data-tour="alliance-guides" aria-labelledby="alliance-guides">
          <h2 id="alliance-guides" className="text-xl font-black text-ink" dir="auto">
            {format(dict["alliance.guides"], { tag: `[${alliance.tag}]` })}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ownGuides.map((guide) => (
              <li key={guide.id}>
                <AllianceGuideLink
                  href={localePath(locale, `/guides/${guide.slug}`)}
                  tag={alliance.tag}
                  className="flex items-center gap-3 rounded-2xl bg-card-soft p-3 font-extrabold text-ink transition-colors hover:bg-primary-soft"
                >
                  <span className="text-2xl" aria-hidden>
                    {guide.icon}
                  </span>
                  <span className="min-w-0 wrap-break-word" dir="auto">
                    {pick(guide.title, locale)}
                  </span>
                </AllianceGuideLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function Stat({ label, title, icon, children }: { label: string; title?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-card-soft px-3 py-2">
      <dt className="flex items-center gap-1 text-xs font-bold text-ink-faint">
        {icon}
        {label}
      </dt>
      <dd className="font-extrabold wrap-break-word text-ink tabular" title={title}>
        {children}
      </dd>
    </div>
  );
}

function AllianceSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-5" aria-hidden>
      <div className="h-9 w-28 rounded-xl bg-card-soft" />
      <div className="card h-56 bg-card-soft" />
      <div className="card h-40 bg-card-soft" />
    </div>
  );
}
