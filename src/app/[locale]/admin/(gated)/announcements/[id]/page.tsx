import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { type AdminAnnouncement, getAnnouncementForEditing } from "@/lib/admin/content-data";
import { BODY_MAX, bodySourceFor, TITLE_MAX } from "@/lib/admin/content-forms";
import { isUuid } from "@/lib/admin/forms";
import { parseEditLang } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit announcement" };

/** "new" is the only id known in advance; real ids are rendered on request (Cache Components wants at least one). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/announcements/[id]">;

/** What a just-created announcement's editor says (the create action redirects here). */
const CREATED: Record<string, string> = {
  live: "Created. Players see it on Home within seconds; the other languages follow within a minute.",
  draft: "Created as a draft: players don't see it until you tick “Show on Home” and save.",
};

export default async function AdminAnnouncementEditorPage({ params, searchParams }: EditorProps) {
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
    <Link href={adminPath(locale, "/announcements")} className="btn-ghost btn-sm">
      ← Back to announcements
    </Link>
  );

  if (id === "new") {
    return (
      <div className="space-y-5">
        <SectionTitle icon="📣" title="New announcement" action={back} />
        <AnnouncementForm announcement={null} bodySource="" locale={locale} />
      </div>
    );
  }

  if (!isUuid(id)) notFound();
  const [announcement, languages] = await Promise.all([getAnnouncementForEditing(id), getLanguages()]);
  if (!announcement) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const created = typeof query.created === "string" ? CREATED[query.created] : undefined;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon="📣"
        title={pick(announcement.title, "en") || "Announcement"}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {back}
            <Link href={`/${locale}`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="announcement-view">
              View Home ↗
            </Link>
          </div>
        }
      />
      <div data-tour="announcement-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/announcements/${announcement.id}`)} />
      </div>
      {created && lang === "en" && (
        <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm font-bold text-success">
          {created}
        </p>
      )}
      {lang === "en" ? (
        <AnnouncementForm announcement={announcement} bodySource={bodySourceFor(announcement, "en")} locale={locale} />
      ) : (
        // Keyed by language: the forms are uncontrolled, so a switch must remount them with that language's text.
        <TranslationMode key={lang} announcement={announcement} locale={locale} lang={lang} langLabel={enabled.find((l) => l.code === lang)!.nativeName} />
      )}
    </div>
  );
}

function TranslationMode({ announcement, locale, lang, langLabel }: { announcement: AdminAnnouncement; locale: string; lang: string; langLabel: string }) {
  return (
    <ContentTranslationMode
      table="announcements"
      id={announcement.id}
      locale={locale}
      lang={lang}
      langLabel={langLabel}
      title="Announcement"
      fields={[
        { column: "title", label: "Title", english: pick(announcement.title, "en"), value: announcement.title[lang] ?? "", pending: announcement.pending.includes("title"), maxLength: TITLE_MAX },
        {
          column: "body",
          label: "Text",
          english: bodySourceFor(announcement, "en"),
          value: announcement.body[lang] ? bodySourceFor(announcement, lang) : "",
          pending: announcement.pending.includes("body"),
          markdown: true,
          maxLength: BODY_MAX,
        },
      ]}
    />
  );
}
