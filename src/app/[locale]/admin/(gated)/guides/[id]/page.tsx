import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { GuideForm } from "@/components/admin/GuideForms";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { type AdminGuide, getGuideForEditing } from "@/lib/admin/content-data";
import { BODY_MAX, bodySourceFor, SUMMARY_MAX, TITLE_MAX } from "@/lib/admin/content-forms";
import { isUuid } from "@/lib/admin/forms";
import { deleteGuideSection } from "@/lib/admin/guides-actions";
import { parseEditLang } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { orderByAlliance } from "@/lib/content/guide-sections";
import { getAlliances, getLanguages } from "@/lib/data";
import type { Alliance } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit guide" };

/** "new" is the only id known in advance; real ids are rendered on request (Cache Components wants at least one). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/guides/[id]">;

/** What a just-created guide's editor says, and what the section delete reports (both redirect here). */
const NOTICES: Record<string, [string, boolean]> = {
  "created:live": ["Created. Players see it on the guides page within seconds; the other languages follow within a minute.", true],
  "created:draft": ["Created as a draft: players don't see it until you tick “Show on the guides page” and save.", true],
  "deleted:section": ["Alliance section deleted.", true],
  "error:forbidden": ["You don't have permission for that.", false],
  "error:delete": ["Deleting failed. Try again in a moment.", false],
};

export default async function AdminGuideEditorPage({ params, searchParams }: EditorProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Editor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ locale, params, searchParams }: { locale: string; params: EditorProps["params"]; searchParams: EditorProps["searchParams"] }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;
  const back = (
    <Link href={adminPath(locale, "/guides")} className="btn-ghost btn-sm">
      ← Back to guides
    </Link>
  );

  if (id === "new") {
    return (
      <div className="space-y-5">
        <SectionTitle icon="📖" title="New guide" action={back} />
        <p className="text-sm font-semibold text-ink-muted">Alliance sections are added once the guide is created.</p>
        <GuideForm guide={null} bodySource="" locale={locale} />
      </div>
    );
  }

  if (!isUuid(id)) notFound();
  const [guide, languages, alliances] = await Promise.all([getGuideForEditing(id), getLanguages(), getAlliances()]);
  if (!guide) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const key = (["created", "deleted", "error"] as const).map((name) => (typeof query[name] === "string" ? `${name}:${query[name]}` : null)).find(Boolean);
  const [notice, good] = key ? (NOTICES[key] ?? ["That didn't work. Try again.", false]) : [null, false];
  const langLabel = enabled.find((l) => l.code === lang)?.nativeName ?? lang;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={guide.icon}
        title={pick(guide.title, "en") || "Guide"}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {back}
            <Link href={`/${locale}/guides/${guide.slug}`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="guide-view">
              View the guide ↗
            </Link>
          </div>
        }
      />
      <div data-tour="guide-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/guides/${guide.id}`)} />
      </div>
      {notice && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-bold ${good ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {notice}
        </p>
      )}
      {lang === "en" ? (
        <GuideForm guide={guide} bodySource={bodySourceFor(guide, "en")} locale={locale} />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="guides"
          id={guide.id}
          locale={locale}
          lang={lang}
          langLabel={langLabel}
          title="Guide"
          fields={[
            { column: "title", label: "Title", english: pick(guide.title, "en"), value: guide.title[lang] ?? "", pending: guide.pending.includes("title"), maxLength: TITLE_MAX },
            {
              column: "summary",
              label: "Summary",
              english: pick(guide.summary, "en"),
              value: guide.summary[lang] ?? "",
              pending: guide.pending.includes("summary"),
              multiline: true,
              maxLength: SUMMARY_MAX,
            },
            {
              column: "body",
              label: "Text for everyone",
              english: bodySourceFor(guide, "en"),
              value: guide.body[lang] ? bodySourceFor(guide, lang) : "",
              pending: guide.pending.includes("body"),
              markdown: true,
              maxLength: BODY_MAX,
            },
          ]}
        />
      )}
      <AllianceSections guide={guide} alliances={alliances} locale={locale} lang={lang} />
    </div>
  );
}

/** The alliance sections: one tab each under the guide's text, in the order of Home's alliances. */
function AllianceSections({ guide, alliances, locale, lang }: { guide: AdminGuide; alliances: Alliance[]; locale: string; lang: string }) {
  const sections = guide.sections && orderByAlliance(guide.sections, alliances);
  const names = new Map(alliances.map((alliance) => [alliance.tag, alliance.name]));
  const free = alliances.filter((alliance) => !guide.sections?.some((section) => section.allianceTag === alliance.tag));
  const query = lang === "en" ? "" : `?lang=${lang}`;
  return (
    <AdminSection
      title="Alliance sections"
      hint="When an alliance plays this event its own way, its section shows as a tab under the text for everyone. Alliances without one follow that text. Any moderator can write any alliance's section."
      tour="guide-sections"
    >
      {sections === null ? (
        <EmptyRow>Alliance sections arrive with a database update that isn&apos;t applied yet. Try again in a few minutes.</EmptyRow>
      ) : (
        <div className="space-y-3">
          {sections.length === 0 ? (
            <EmptyRow>No alliance sections yet: every player follows the text above.</EmptyRow>
          ) : (
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft p-3">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-extrabold wrap-break-word text-ink" dir="ltr">
                      [{section.allianceTag}] {names.get(section.allianceTag) ?? ""}
                    </p>
                    {(!section.published || section.pending.length > 0 || !names.has(section.allianceTag)) && (
                      <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-ink-muted">
                        {!section.published && <span className="chip bg-gold-soft text-gold-ink">Draft</span>}
                        {section.pending.length > 0 && <span className="chip bg-card text-ink-muted">⏳ Translating</span>}
                        {!names.has(section.allianceTag) && <span>Not on Home&apos;s alliance list: the tab shows the tag only.</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                    <Link href={adminPath(locale, `/guides/${guide.id}/alliances/${section.id}${query}`)} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                    <DeleteForm
                      action={deleteGuideSection}
                      hidden={{ locale, guideId: guide.id, id: section.id }}
                      confirmText={`Delete the [${section.allianceTag}] section of this guide in every language? This can't be undone.`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {free.length > 0 && (
            <Link href={adminPath(locale, `/guides/${guide.id}/alliances/new`)} className="btn-ghost btn-sm" data-tour="guide-sections-add">
              + Add an alliance section
            </Link>
          )}
        </div>
      )}
    </AdminSection>
  );
}
