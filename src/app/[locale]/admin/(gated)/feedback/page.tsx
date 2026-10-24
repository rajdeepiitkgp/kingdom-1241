import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { utcLabel } from "@/lib/admin/format";
import { listPlans } from "@/lib/admin/kvk-data";
import { listRetrospectives } from "@/lib/admin/retro-data";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Feedback" };

const NOTICES: Record<string, string> = {
  missing: "That feedback form no longer exists.",
  forbidden: "You don't have permission for that.",
};

export default async function AdminFeedbackPage({ searchParams }: PageProps<"/[locale]/admin/feedback">) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <FeedbackList locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function FeedbackList({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/admin/feedback">["searchParams"] }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  const [params, retros, plans] = await Promise.all([searchParams, listRetrospectives(), listPlans()]);
  const retroByPlan = new Map(retros.map((r) => [r.planId, r]));
  const notice = typeof params.error === "string" ? (NOTICES[params.error] ?? "That didn't work. Try again.") : null;

  return (
    <div className="space-y-5">
      <SectionTitle icon="📝" title="Battle feedback" />
      {notice && (
        <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {notice}
        </p>
      )}
      <p className="text-sm font-semibold text-ink-muted">
        One feedback form per battle plan. Set it up below (or in the plan editor under “Player feedback”), then tick <b>Open</b>: players reach it from
        the card on the battle plan and at /kvk/feedback while it is open. Answers are deleted automatically after the retention period: export them before.
      </p>
      {plans.length === 0 ? (
        <EmptyRow>
          No battle plans yet.{" "}
          <Link href={adminPath(locale, "/kvk/new")} className="font-bold text-primary underline">
            Create one first.
          </Link>
        </EmptyRow>
      ) : (
        <ul className="space-y-3">
          {plans.map((plan) => {
            const retro = retroByPlan.get(plan.id) ?? null;
            const title = pick(plan.title, "en") || plan.slug;
            return (
              <li key={plan.id} className="card flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-extrabold text-ink">
                    {title}
                    {plan.active && <span className="chip bg-gold-soft text-gold-ink">Active plan</span>}
                    {retro ? (
                      retro.open ? (
                        <span className="chip bg-success-soft text-success">Feedback open</span>
                      ) : (
                        <span className="chip bg-card-soft text-ink-muted">Feedback closed</span>
                      )
                    ) : (
                      <span className="chip bg-card-soft text-ink-faint">No feedback form yet</span>
                    )}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {plan.eventType === "kvk" ? "KvK" : "Castle battle"} · battle {plan.battleAt ? `${utcLabel(plan.battleAt)} UTC` : "date not set"}
                    {retro && (
                      <>
                        {" "}
                        · <span className="font-bold text-ink">{retro.responseCount}</span> of {retro.maxResponses} responses
                        {retro.closesAt && ` · closes ${utcLabel(retro.closesAt)} UTC`} · answers deleted {utcLabel(retro.pruneAt)} UTC
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {retro ? (
                    <>
                      <Link href={adminPath(locale, `/feedback/${plan.id}`)} className="btn-primary btn-sm">
                        Results
                      </Link>
                      <Link href={adminPath(locale, `/kvk/${plan.id}#feedback`)} className="btn-ghost btn-sm">
                        Settings
                      </Link>
                    </>
                  ) : (
                    <Link href={adminPath(locale, `/kvk/${plan.id}#feedback`)} className="btn-primary btn-sm">
                      Set up feedback
                    </Link>
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
