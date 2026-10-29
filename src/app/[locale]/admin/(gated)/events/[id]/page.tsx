import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { EventForm } from "@/components/admin/EventForm";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listGuides } from "@/lib/admin/content-data";
import { getEventForEditing } from "@/lib/admin/events-data";
import { isUuid } from "@/lib/admin/forms";
import { EVENT_NAME_MAX, EVENT_SUMMARY_MAX } from "@/lib/admin/site-forms";
import { parseEditLang } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit event" };

/** "new" is the only id known in advance; real ids are rendered on request (Cache Components wants at least one). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/events/[id]">;

/** What a just-created event's editor says (the create redirects here). */
const NOTICES: Record<string, string> = {
  live: "Created. Players see it on Home and the events page within seconds; the other languages follow within a minute.",
  draft: "Created as hidden: players don't see it until you tick “Show on the events page and Home” and save.",
};

export default async function AdminEventEditorPage({ params, searchParams }: EditorProps) {
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
  const guides = ((await listGuides()) ?? []).map((guide) => ({ slug: guide.slug, title: pick(guide.title, "en") || guide.slug }));
  const back = (
    <Link href={adminPath(locale, "/events")} className="btn-ghost btn-sm">
      ← Back to events
    </Link>
  );

  if (id === "new") {
    return (
      <div className="space-y-5">
        <SectionTitle icon="📅" title="New event" action={back} />
        <EventForm event={null} guides={guides} locale={locale} />
      </div>
    );
  }

  if (!isUuid(id)) notFound();
  const [event, languages] = await Promise.all([getEventForEditing(id), getLanguages()]);
  if (!event) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const notice = typeof query.created === "string" ? (NOTICES[query.created] ?? null) : null;
  const langLabel = enabled.find((l) => l.code === lang)?.nativeName ?? lang;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={event.icon}
        title={pick(event.name, "en") || "Event"}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {back}
            <Link href={`/${locale}/events`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="event-view">
              View the events page ↗
            </Link>
          </div>
        }
      />
      <div data-tour="event-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/events/${event.id}`)} />
      </div>
      {notice && (
        <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm font-bold text-success">
          {notice}
        </p>
      )}
      {lang === "en" ? (
        <EventForm event={event} guides={guides} locale={locale} />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="events"
          id={event.id}
          locale={locale}
          lang={lang}
          langLabel={langLabel}
          title="Event"
          fields={[
            { column: "name", label: "Name", english: pick(event.name, "en"), value: event.name[lang] ?? "", pending: event.pending.includes("name"), maxLength: EVENT_NAME_MAX },
            {
              column: "summary",
              label: "Summary",
              english: pick(event.summary, "en"),
              value: event.summary[lang] ?? "",
              pending: event.pending.includes("summary"),
              multiline: true,
              maxLength: EVENT_SUMMARY_MAX,
            },
          ]}
        />
      )}
    </div>
  );
}
