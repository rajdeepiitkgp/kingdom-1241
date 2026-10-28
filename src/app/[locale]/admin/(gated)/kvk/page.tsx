import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { utcLabel } from "@/lib/admin/format";
import { deletePlan, duplicatePlan } from "@/lib/admin/kvk-actions";
import { listPlans } from "@/lib/admin/kvk-data";
import { adminPath } from "@/lib/auth/paths";
import { canManageUsers } from "@/lib/auth/roles";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Battle plans" };

const NOTICES: Record<string, string> = {
  deleted: "Plan deleted.",
  forbidden: "Only administrators can delete plans.",
  missing: "That plan no longer exists.",
  delete: "Deleting failed. Try again in a moment.",
  duplicate: "Copying failed. Try again in a moment.",
};

export default async function AdminPlansPage({ searchParams }: PageProps<"/[locale]/admin/kvk">) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <PlanList locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanList({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/admin/kvk">["searchParams"] }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  const [params, plans] = await Promise.all([searchParams, listPlans()]);
  const isAdmin = canManageUsers(user.role);
  const noticeKey = typeof params.deleted === "string" ? "deleted" : typeof params.error === "string" ? params.error : null;
  const notice = noticeKey ? (NOTICES[noticeKey] ?? "That didn't work. Try again.") : null;

  return (
    <div className="space-y-5">
      <SectionTitle
        icon="⚔️"
        title="Battle plans"
        action={
          <Link href={adminPath(locale, "/kvk/new")} className="btn-primary btn-sm" data-tour="plans-new">
            New plan
          </Link>
        }
      />
      {notice && (
        <p role="status" className="rounded-xl bg-card-soft px-3 py-2 text-sm font-bold text-ink">
          {notice}
        </p>
      )}
      <p className="text-sm font-semibold text-ink-muted">
        One plan is active at a time: that is what players see on the KvK page. Duplicate the current plan to prepare the
        next battle, edit the copy, then make it active when it is ready.
      </p>
      {plans.length === 0 ? (
        <EmptyRow>No plans yet.</EmptyRow>
      ) : (
        <ul className="space-y-3" data-tour="plans-list">
          {plans.map((plan) => {
            const title = pick(plan.title, "en") || plan.slug;
            return (
              <li key={plan.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-extrabold text-ink">
                    {title}
                    {plan.active && <span className="chip bg-success-soft text-success">Active</span>}
                    {!plan.published && <span className="chip bg-card-soft text-ink-muted">Unpublished</span>}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {plan.eventType === "kvk" ? "KvK" : "Castle battle"} · battle{" "}
                    {plan.battleAt ? `${utcLabel(plan.battleAt)} UTC` : "date not set"} · {plan.formationCount} formations · updated{" "}
                    {utcLabel(plan.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour="plans-actions">
                  <Link href={adminPath(locale, `/kvk/${plan.id}`)} className="btn-primary btn-sm">
                    Edit
                  </Link>
                  <Link href={adminPath(locale, `/kvk/${plan.id}/leaders`)} className="btn-ghost btn-sm">
                    Rally leaders
                  </Link>
                  <Link href={adminPath(locale, `/kvk/${plan.id}/checklist`)} className="btn-ghost btn-sm">
                    Checklist
                  </Link>
                  <form action={duplicatePlan}>
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="id" value={plan.id} />
                    <button type="submit" className="btn-ghost btn-sm">
                      Duplicate
                    </button>
                  </form>
                  {isAdmin && (
                    <DeleteForm
                      action={deletePlan}
                      hidden={{ locale, id: plan.id }}
                      confirmText={`Delete "${title}" with all its instructions, coordinators, formations, rally leaders, checklist and player feedback? This cannot be undone.`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
