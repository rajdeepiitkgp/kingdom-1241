import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listAllianceProfiles } from "@/lib/admin/kingdom-data";
import { alliancePath } from "@/lib/alliances/pages";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Alliance pages" };

/** Markers of the first row only (one marker per page). */
const FIRST_ROW = { filledTour: "alliances-filled", actionsTour: "alliances-actions" };

export default async function AdminAlliancesPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Alliances locale={locale} />
    </Suspense>
  );
}

async function Alliances({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  const alliances = await listAllianceProfiles();
  return (
    <div className="space-y-5">
      <SectionTitle icon="🛡️" title="Alliance pages" />
      <p className="text-sm font-semibold text-ink-muted">
        Every alliance on Home has its own page. Its rank, power, leader and members come from MightPulse every day; here you write what its leaders say about it: a
        few lines about the alliance, what it asks of new members, its languages and its Discord invite.{" "}
        {user.isOwner ? (
          <>
            Which alliances are listed is yours to change in <Link href={adminPath(locale, "/settings/alliances")} className="underline">Settings → Alliances</Link>.
          </>
        ) : (
          <>Which alliances are listed is the owner&apos;s choice.</>
        )}
      </p>
      <AdminSection title="Alliances" hint="Strongest first, like Home. Hidden ones have no page until the owner shows them again." tour="alliances-list">
        {alliances === null ? (
          <EmptyRow>The alliances could not be read from the database.</EmptyRow>
        ) : alliances.length === 0 ? (
          <EmptyRow>No alliances yet. The owner adds them in Settings → Alliances.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {alliances.map((alliance, index) => {
              const filled = [
                pick(alliance.description, "en") && "about",
                pick(alliance.requirements, "en") && "requirements",
                alliance.languages && "languages",
                alliance.discordUrl && "Discord",
              ].filter(Boolean);
              return (
                <li key={alliance.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft p-3">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-xs font-black text-white"
                    style={{ backgroundColor: alliance.color }}
                    dir="ltr"
                    aria-hidden
                  >
                    {alliance.tag}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-extrabold wrap-break-word text-ink" dir="ltr">
                      [{alliance.tag}] {alliance.name}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-muted" data-tour={index === 0 ? FIRST_ROW.filledTour : undefined}>
                      {!alliance.published && <span className="chip bg-gold-soft text-gold-ink">Hidden from Home</span>}
                      {alliance.pending.length > 0 && <span className="chip bg-card text-ink-muted">⏳ Translating</span>}
                      <span>{filled.length > 0 ? `Has: ${filled.join(", ")}` : "Nothing written yet"}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour={index === 0 ? FIRST_ROW.actionsTour : undefined}>
                    <Link href={adminPath(locale, `/alliances/${alliance.id}`)} className="btn-ghost btn-sm">
                      Edit
                    </Link>
                    {alliance.published && (
                      <Link href={`/${locale}${alliancePath(alliance.tag)}`} className="btn-ghost btn-sm" target="_blank" rel="noopener">
                        View ↗
                      </Link>
                    )}
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
