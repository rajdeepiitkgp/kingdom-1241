import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { deleteEvent } from "@/lib/admin/events-actions";
import { listEvents } from "@/lib/admin/events-data";
import { scheduleSummary } from "@/lib/admin/site-forms";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Events" };

/** What the delete action reports through the address (it redirects instead of returning a state). */
const NOTICES: Record<string, string> = {
  deleted: "Event deleted.",
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

/** Markers of the first row only (one marker per page). */
const FIRST_ROW = { scheduleTour: "events-schedule", actionsTour: "events-actions" };

type ListProps = PageProps<"/[locale]/admin/events">;

export default async function AdminEventsPage({ searchParams }: ListProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Events locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Events({ locale, searchParams }: { locale: string; searchParams: ListProps["searchParams"] }) {
  if (!(await requireEditor(locale))) return null;
  const [query, events] = await Promise.all([searchParams, listEvents()]);
  const key = typeof query.error === "string" ? query.error : query.deleted ? "deleted" : null;
  const notice = key ? (NOTICES[key] ?? "That didn't work. Try again.") : null;
  return (
    <div className="space-y-5">
      <SectionTitle
        icon="📅"
        title="Events"
        action={
          <Link href={adminPath(locale, "/events/new")} className="btn-primary btn-sm" data-tour="events-new">
            New event
          </Link>
        }
      />
      <p className="text-sm font-semibold text-ink-muted">
        The kingdom&apos;s event calendar on Home and the events page, in every language. Players see each event&apos;s next round, with a countdown when it starts at
        the same time for everyone. You write in English; the other languages follow within a minute of saving.
      </p>
      {notice && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-bold ${key === "deleted" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {notice}
        </p>
      )}
      <AdminSection title="All events" hint="By their first round. Hidden events are kept here; players only see the others." tour="events-list">
        {events === null ? (
          <EmptyRow>The events could not be read from the database.</EmptyRow>
        ) : events.length === 0 ? (
          <EmptyRow>No events yet. The events page and Home show “no events” until you add one.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {events.map((event, index) => (
              <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft p-3">
                <span className="text-3xl" aria-hidden>
                  {event.icon}
                </span>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-extrabold wrap-break-word text-ink" dir="ltr">
                    {pick(event.name, "en") || "Untitled"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-ink-muted" dir="ltr" data-tour={index === 0 ? FIRST_ROW.scheduleTour : undefined}>
                    {scheduleSummary(event)}
                  </p>
                  {(!event.published || event.pending.length > 0) && (
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
                      {!event.published && <span className="chip bg-gold-soft text-gold-ink">Hidden</span>}
                      {event.pending.length > 0 && <span className="chip bg-card text-ink-muted">⏳ Translating</span>}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour={index === 0 ? FIRST_ROW.actionsTour : undefined}>
                  <Link href={adminPath(locale, `/events/${event.id}`)} className="btn-ghost btn-sm">
                    Edit
                  </Link>
                  <DeleteForm
                    action={deleteEvent}
                    hidden={{ locale, id: event.id }}
                    confirmText={`Delete the event “${pick(event.name, "en")}” in every language? This can't be undone.`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
