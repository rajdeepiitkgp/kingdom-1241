import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { deleteAnnouncement } from "@/lib/admin/content-actions";
import { listAnnouncements } from "@/lib/admin/content-data";
import { utcLabel } from "@/lib/admin/format";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Announcements" };

/** What the delete action reports through the address (it redirects instead of returning a state). */
const NOTICES: Record<string, string> = {
  deleted: "Announcement deleted.",
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

/** Guide markers of the first row only (one marker per page). */
const FIRST_ROW = { stateTour: "announcements-state", actionsTour: "announcements-actions" };

const STATES = {
  live: ["On Home", "bg-success-soft text-success"],
  draft: ["Draft", "bg-gold-soft text-gold-ink"],
  expired: ["Expired", "bg-card-soft text-ink-muted"],
} as const;

type ListProps = PageProps<"/[locale]/admin/announcements">;

export default async function AdminAnnouncementsPage({ searchParams }: ListProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Announcements locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Announcements({ locale, searchParams }: { locale: string; searchParams: ListProps["searchParams"] }) {
  if (!(await requireEditor(locale))) return null;
  const [query, announcements] = await Promise.all([searchParams, listAnnouncements()]);
  const key = typeof query.error === "string" ? query.error : query.deleted ? "deleted" : null;
  const notice = key ? (NOTICES[key] ?? "That didn't work. Try again.") : null;
  return (
    <div className="space-y-5">
      <SectionTitle
        icon="📣"
        title="Announcements"
        action={
          <Link href={adminPath(locale, "/announcements/new")} className="btn-primary btn-sm" data-tour="announcements-new">
            New announcement
          </Link>
        }
      />
      <p className="text-sm font-semibold text-ink-muted">
        The news on Home, in every language: you write it in English, the other languages follow within a minute of saving. Pinned ones come first, then the
        newest.
      </p>
      {notice && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-bold ${key === "deleted" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {notice}
        </p>
      )}
      <AdminSection title="All announcements" hint="Drafts and expired ones are kept here; players only see the ones marked “On Home”." tour="announcements-list">
        {announcements === null ? (
          <EmptyRow>The announcements could not be read from the database.</EmptyRow>
        ) : announcements.length === 0 ? (
          <EmptyRow>No announcements yet. Home shows none until you add one.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {announcements.map((announcement, index) => {
              const [chip, tone] = STATES[announcement.state];
              return (
                <li key={announcement.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft p-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="font-extrabold wrap-break-word text-ink" dir="ltr">
                      {pick(announcement.title, "en") || "Untitled"}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-muted">
                      <span className={`chip ${tone}`} data-tour={index === 0 ? FIRST_ROW.stateTour : undefined}>
                        {chip}
                      </span>
                      {announcement.pinned && <span className="chip bg-primary-soft text-ink">📌 Pinned</span>}
                      {announcement.pending.length > 0 && <span className="chip bg-card text-ink-muted">⏳ Translating</span>}
                      <span>Since {utcLabel(announcement.publishedAt)} UTC</span>
                      {announcement.expiresAt && <span>· leaves Home {utcLabel(announcement.expiresAt)} UTC</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour={index === 0 ? FIRST_ROW.actionsTour : undefined}>
                    <Link href={adminPath(locale, `/announcements/${announcement.id}`)} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                    <DeleteForm
                      action={deleteAnnouncement}
                      hidden={{ locale, id: announcement.id }}
                      confirmText={`Delete “${pick(announcement.title, "en")}” in every language? This can't be undone.`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
