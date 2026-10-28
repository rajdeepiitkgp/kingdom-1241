import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ProfileForm } from "@/components/admin/ProfileForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { recentAudit } from "@/lib/admin/audit";
import { utcLabel } from "@/lib/admin/format";
import { listPlans } from "@/lib/admin/kvk-data";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getAlliances } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Admin" };

/** Pages render in parallel with their layouts, so each page gates itself and streams its own data behind Suspense. */
export default async function AdminOverviewPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Overview locale={locale} />
    </Suspense>
  );
}

async function Overview({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  const [plans, entries, alliances] = await Promise.all([listPlans(), recentAudit(12), getAlliances()]);
  const active = plans.find((p) => p.active) ?? null;

  return (
    <div className="space-y-6">
      <section data-tour="admin-active-plan">
        <SectionTitle
          icon="⚔️"
          title="Battle plan"
          action={
            <Link href={adminPath(locale, "/kvk")} className="btn-ghost btn-sm">
              All plans
            </Link>
          }
        />
        {active ? (
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-ink">{pick(active.title, "en")}</p>
              <p className="text-sm text-ink-muted">
                {active.eventType === "kvk" ? "KvK" : "Castle battle"} · battle {active.battleAt ? `${utcLabel(active.battleAt)} UTC` : "date not set"} ·{" "}
                {active.formationCount} formations
              </p>
            </div>
            <Link href={adminPath(locale, `/kvk/${active.id}`)} className="btn-primary btn-sm">
              Edit
            </Link>
          </div>
        ) : (
          <EmptyRow>
            No active plan: players see &ldquo;no plan&rdquo; on the KvK page.{" "}
            <Link href={adminPath(locale, "/kvk")} className="font-bold text-primary underline">
              Pick or create one.
            </Link>
          </EmptyRow>
        )}
      </section>

      <AdminSection title="Your profile" tour="admin-profile" hint="Your in-game name is shown in the user list and on every change you make.">
        <ProfileForm gameName={user.gameName} allianceTag={user.allianceTag} alliances={alliances} path={adminPath(locale)} />
      </AdminSection>

      <AdminSection title="Recent changes" tour="admin-audit" hint="The last edits made in the admin area, newest first.">
        {entries.length === 0 ? (
          <EmptyRow>Nothing yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap gap-x-3 gap-y-0.5 py-2">
                <span className="w-36 shrink-0 text-ink-faint tabular">{utcLabel(entry.createdAt)}</span>
                <span className="font-bold text-ink">{entry.actorName || "—"}</span>
                <span className="text-ink-muted" dir="ltr">
                  {entry.action}
                  {typeof entry.details.slug === "string" ? ` · ${entry.details.slug}` : ""}
                  {typeof entry.details.summary === "string" ? ` · ${entry.details.summary}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
