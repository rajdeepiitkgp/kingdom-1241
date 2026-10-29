import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { GuideSectionForm } from "@/components/admin/GuideForms";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getGuideForEditing, getGuideSectionForEditing } from "@/lib/admin/content-data";
import { BODY_MAX, bodySourceFor } from "@/lib/admin/content-forms";
import { isUuid } from "@/lib/admin/forms";
import { parseEditLang } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { allianceLabel } from "@/lib/content/guide-sections";
import { getAlliances, getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit alliance section" };

/** Guides and sections are rendered on request; Cache Components wants one set of params in advance. */
export function generateStaticParams() {
  return [{ id: "new", sectionId: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/guides/[id]/alliances/[sectionId]">;

/** What a just-created section's editor says (the create action redirects here). */
const CREATED: Record<string, string> = {
  live: "Created. Players see it as a tab in the guide within seconds; the other languages follow within a minute.",
  draft: "Created as a draft: players don't see it until you tick “Show on the guide” and save.",
};

export default async function AdminGuideSectionEditorPage({ params, searchParams }: EditorProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Editor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ locale, params, searchParams }: { locale: string; params: EditorProps["params"]; searchParams: EditorProps["searchParams"] }) {
  const [{ id, sectionId }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;
  if (!isUuid(id)) notFound();
  const [guide, alliances, languages] = await Promise.all([getGuideForEditing(id), getAlliances(), getLanguages()]);
  if (!guide) notFound();
  const names = new Map(alliances.map((alliance) => [alliance.tag, alliance.name]));
  const back = (
    <Link href={adminPath(locale, `/guides/${guide.id}`)} className="btn-ghost btn-sm">
      ← Back to {pick(guide.title, "en") || "the guide"}
    </Link>
  );

  if (sectionId === "new") {
    const free = alliances.filter((alliance) => !guide.sections?.some((section) => section.allianceTag === alliance.tag));
    return (
      <div className="space-y-5">
        <SectionTitle icon={guide.icon} title={`New alliance section · ${pick(guide.title, "en")}`} action={back} />
        {guide.sections === null ? (
          <EmptyRow>Alliance sections arrive with a database update that isn&apos;t applied yet. Try again in a few minutes.</EmptyRow>
        ) : free.length === 0 ? (
          <EmptyRow>Every alliance on the list already has a section in this guide.</EmptyRow>
        ) : (
          <GuideSectionForm guideId={guide.id} section={null} alliances={free.map(({ tag, name }) => ({ tag, name }))} bodySource="" locale={locale} />
        )}
      </div>
    );
  }

  if (!isUuid(sectionId)) notFound();
  const section = await getGuideSectionForEditing(guide.id, sectionId);
  if (!section) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const created = typeof query.created === "string" ? CREATED[query.created] : undefined;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={guide.icon}
        title={`${allianceLabel(section.allianceTag, names.get(section.allianceTag))} · ${pick(guide.title, "en")}`}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {back}
            <Link href={`/${locale}/guides/${guide.slug}`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="guide-section-view">
              View the guide ↗
            </Link>
          </div>
        }
      />
      <div data-tour="guide-section-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/guides/${guide.id}/alliances/${section.id}`)} />
      </div>
      {created && lang === "en" && (
        <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm font-bold text-success">
          {created}
        </p>
      )}
      {lang === "en" ? (
        <GuideSectionForm guideId={guide.id} section={section} alliances={[]} bodySource={bodySourceFor(section, "en")} locale={locale} />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="guide_sections"
          id={section.id}
          locale={locale}
          lang={lang}
          langLabel={enabled.find((l) => l.code === lang)!.nativeName}
          title={`[${section.allianceTag}] section`}
          fields={[
            {
              column: "body",
              label: "How this alliance plays it",
              english: bodySourceFor(section, "en"),
              value: section.body[lang] ? bodySourceFor(section, lang) : "",
              pending: section.pending.includes("body"),
              markdown: true,
              maxLength: BODY_MAX,
            },
          ]}
        />
      )}
    </div>
  );
}
