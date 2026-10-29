import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listGuides } from "@/lib/admin/content-data";
import { deleteGuide } from "@/lib/admin/guides-actions";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Guides" };

/** What the delete action reports through the address (it redirects instead of returning a state). */
const NOTICES: Record<string, string> = {
  deleted: "Guide deleted.",
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

/** Guide markers of the first row only (one marker per page). */
const FIRST_ROW = { orderTour: "guides-order", stateTour: "guides-state", actionsTour: "guides-actions" };

type ListProps = PageProps<"/[locale]/admin/guides">;

export default async function AdminGuidesPage({ searchParams }: ListProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Guides locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Guides({ locale, searchParams }: { locale: string; searchParams: ListProps["searchParams"] }) {
  if (!(await requireEditor(locale))) return null;
  const [query, guides] = await Promise.all([searchParams, listGuides()]);
  const key = typeof query.error === "string" ? query.error : query.deleted ? "deleted" : null;
  const notice = key ? (NOTICES[key] ?? "That didn't work. Try again.") : null;
  return (
    <div className="space-y-5">
      <SectionTitle
        icon="📖"
        title="Guides"
        action={
          <Link href={adminPath(locale, "/guides/new")} className="btn-primary btn-sm" data-tour="guides-new">
            New guide
          </Link>
        }
      />
      <p className="text-sm font-semibold text-ink-muted">
        How 1241 plays each event, in every language: a text for everyone, and a section for each alliance that plays it its own way. You write in English; the
        other languages follow within a minute of saving.
      </p>
      {notice && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-bold ${key === "deleted" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {notice}
        </p>
      )}
      <AdminSection title="All guides" hint="In the order of the guides page. Drafts are kept here; players only see the others." tour="guides-list">
        {guides === null ? (
          <EmptyRow>The guides could not be read from the database.</EmptyRow>
        ) : guides.length === 0 ? (
          <EmptyRow>No guides yet. The guides page stays empty until you add one.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {guides.map((guide, index) => {
              const sections = guide.sections ?? [];
              return (
                <li key={guide.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft p-3">
                  <div data-tour={index === 0 ? FIRST_ROW.orderTour : undefined}>
                    <MoveButtons locale={locale} table="guides" id={guide.id} position={index} count={guides.length} label="guide" />
                  </div>
                  <span className="text-3xl" aria-hidden>
                    {guide.icon}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-extrabold wrap-break-word text-ink" dir="ltr">
                      {pick(guide.title, "en") || "Untitled"}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-muted" data-tour={index === 0 ? FIRST_ROW.stateTour : undefined}>
                      <span className={`chip ${guide.published ? "bg-success-soft text-success" : "bg-gold-soft text-gold-ink"}`}>{guide.published ? "Shown" : "Draft"}</span>
                      {guide.pending.length > 0 && <span className="chip bg-card text-ink-muted">⏳ Translating</span>}
                      <span dir="ltr">/guides/{guide.slug}</span>
                      {sections.length > 0 && (
                        <span dir="ltr">· {sections.map((section) => `[${section.allianceTag}]`).join(" ")}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour={index === 0 ? FIRST_ROW.actionsTour : undefined}>
                    <Link href={adminPath(locale, `/guides/${guide.id}`)} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                    <DeleteForm
                      action={deleteGuide}
                      hidden={{ locale, id: guide.id }}
                      confirmText={`Delete the guide “${pick(guide.title, "en")}”${sections.length ? ` and its ${sections.length} alliance sections` : ""} in every language? This can't be undone.`}
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
