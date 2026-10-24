import clsx from "clsx";
import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { utcLabel } from "@/lib/admin/format";
import { deleteAllResponses, deleteResponse } from "@/lib/admin/retro-actions";
import { getRetrospectiveByPlan, listResponses } from "@/lib/admin/retro-data";
import { adminPath } from "@/lib/auth/paths";
import { canManageUsers } from "@/lib/auth/roles";
import { requireEditor } from "@/lib/auth/server";
import type { RetroResponse } from "@/lib/data/types";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { RATING_MAX, RATING_MIN, shownRatings, shownTexts } from "@/lib/retro/questions";
import { formatAverage, overallAverage, percent, summarizeByAlliance, summarizeRatings } from "@/lib/retro/summary";

export const metadata: Metadata = { title: "Feedback results" };

type ResultsProps = PageProps<"/[locale]/admin/feedback/[planId]">;

const NOTICES: Record<string, string> = {
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

/** Colour of each 0…5 bucket in the distribution bars. */
const BUCKET_CLASS = ["bg-danger", "bg-danger/60", "bg-gold", "bg-primary/50", "bg-primary", "bg-success"];

export default async function FeedbackResultsPage({ params, searchParams }: ResultsProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Results locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ locale, params, searchParams }: { locale: string; params: ResultsProps["params"]; searchParams: ResultsProps["searchParams"] }) {
  const [{ planId }, query] = await Promise.all([params, searchParams]);
  const user = await requireEditor(locale);
  if (!user) return null;
  const retro = await getRetrospectiveByPlan(planId);
  if (!retro) notFound();
  const [responses, en] = await Promise.all([listResponses(retro.id, { identity: user.isOwner }), getDictionary("en")]);

  const ratings = shownRatings(retro.config);
  const texts = shownTexts(retro.config);
  const summaries = summarizeRatings(responses, ratings.map((q) => q.key));
  const overall = overallAverage(summaries);
  const byAlliance = summarizeByAlliance(responses, ratings.map((q) => q.key));
  const labelOf = (key: string) => en[(ratings.find((q) => q.key === key) ?? texts.find((t) => t.key === key))!.labelKey];
  const notice =
    typeof query.deleted === "string"
      ? "Response deleted."
      : typeof query.cleared === "string"
        ? "All responses of this battle were deleted."
        : typeof query.error === "string"
          ? (NOTICES[query.error] ?? "That didn't work. Try again.")
          : null;
  const title = pick(retro.plan.title, "en") || retro.plan.slug;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon="📝"
        title={title}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={adminPath(locale, "/feedback")} className="btn-ghost btn-sm">
              ← All feedback
            </Link>
            <Link href={adminPath(locale, `/kvk/${retro.planId}#feedback`)} className="btn-ghost btn-sm">
              Settings
            </Link>
            {responses.length > 0 && (
              <a href={adminPath(locale, `/feedback/${retro.planId}/export`)} className="btn-primary btn-sm" download>
                Export CSV
              </a>
            )}
          </div>
        }
      />
      {notice && (
        <p role="status" className={clsx("rounded-xl px-3 py-2 text-sm font-bold", typeof query.error === "string" ? "bg-danger-soft text-danger" : "bg-card-soft text-ink")}>
          {notice}
        </p>
      )}

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm font-semibold text-ink-muted">
        <span>
          {retro.open ? <span className="chip bg-success-soft text-success">Open</span> : <span className="chip bg-card-soft text-ink-muted">Closed</span>}
        </span>
        <span>
          <span className="font-black text-ink">{retro.responseCount}</span> of {retro.maxResponses} responses
        </span>
        <span>Battle {retro.plan.battleAt ? `${utcLabel(retro.plan.battleAt)} UTC` : "date not set"}</span>
        {retro.closesAt && <span>Closes {utcLabel(retro.closesAt)} UTC</span>}
        <span>Answers deleted {utcLabel(retro.pruneAt)} UTC</span>
        {user.isOwner ? (
          <span className="chip bg-gold-soft text-gold-ink">Owner view: Governor IDs and names shown</span>
        ) : (
          <span className="chip bg-card-soft text-ink-muted">Identity hidden (owner only)</span>
        )}
      </div>

      <AdminSection title="Summary" hint="Averages on the 0–5 scale and how the answers spread. The CSV has every row for your own charts.">
        {responses.length === 0 ? (
          <EmptyRow>No responses yet.</EmptyRow>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">Overall mood</p>
                <p className="text-4xl font-black text-ink tabular">
                  {formatAverage(overall)} <span className="text-base text-ink-faint">/ 5</span>
                </p>
              </div>
              <p className="text-sm font-semibold text-ink-muted">
                {responses.length} response{responses.length === 1 ? "" : "s"} · {responses.filter((r) => r.verified).length} with a verified Governor ID ·{" "}
                {responses.filter((r) => Object.values(r.texts).some((t) => t.trim())).length} with written feedback
              </p>
            </div>
            <ul className="space-y-3">
              {summaries.map((s) => (
                <li key={s.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                  <p className="min-w-0 font-bold wrap-break-word text-ink">{labelOf(s.key)}</p>
                  <p className="text-end text-xl font-black text-ink tabular md:order-3">
                    {formatAverage(s.average)}
                    <span className="ms-1 text-xs font-bold text-ink-faint">({s.count})</span>
                  </p>
                  <div className="col-span-2 min-w-0 md:order-2 md:col-span-1">
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-card-soft" role="img" aria-label={s.distribution.map((n, i) => `${i}: ${n}`).join(", ")}>
                      {s.distribution.map((n, i) =>
                        n > 0 ? <span key={i} className={BUCKET_CLASS[i]} style={{ width: `${percent(n, s.count)}%` }} title={`${i} stars: ${n}`} /> : null,
                      )}
                    </div>
                    <p className="mt-1 flex justify-between text-[0.6875rem] font-bold text-ink-faint tabular" dir="ltr">
                      {s.distribution.map((n, i) => (
                        <span key={i}>
                          {RATING_MIN + i}: {n}
                        </span>
                      ))}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {byAlliance.length > 1 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-ink-faint">
                      <th className="py-1 text-start font-bold">Alliance</th>
                      <th className="py-1 text-end font-bold">Responses</th>
                      {ratings.map((q) => (
                        <th key={q.key} className="py-1 text-end font-bold" title={labelOf(q.key)}>
                          {q.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {byAlliance.map((group) => (
                      <tr key={group.tag ?? "-"} className="border-t border-line">
                        <td className="py-1.5 font-bold text-ink">{group.tag ? `[${group.tag}]` : "Other / none"}</td>
                        <td className="py-1.5 text-end tabular">{group.count}</td>
                        {ratings.map((q) => (
                          <td key={q.key} className="py-1.5 text-end tabular">
                            {formatAverage(group.averages[q.key] ?? null)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </AdminSection>

      <AdminSection title={`Responses (${responses.length})`} hint="Newest first. Texts are shown as written, in the player's language; the chip shows the page language they used.">
        {responses.length === 0 ? (
          <EmptyRow>Nothing yet. Share the battle plan link: the feedback card is at its top while the form is open.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {responses.map((r) => (
              <ResponseCard key={r.id} response={r} locale={locale} planId={retro.planId} ratingLabel={labelOf} textLabel={labelOf} ratingKeys={ratings.map((q) => q.key)} textKeys={texts.map((t) => t.key)} />
            ))}
          </ul>
        )}
      </AdminSection>

      {canManageUsers(user.role) && responses.length > 0 && (
        <AdminSection title="Delete all responses" hint="Removes every answer of this battle now instead of waiting for the retention period. Export the CSV first; this cannot be undone.">
          <DeleteForm
            action={deleteAllResponses}
            hidden={{ locale, planId: retro.planId }}
            confirmText={`Delete all ${responses.length} responses for "${title}"? Export them first if you want to keep them. This cannot be undone.`}
            label={`Delete all ${responses.length} responses`}
          />
        </AdminSection>
      )}
    </div>
  );
}

function ResponseCard({
  response: r,
  locale,
  planId,
  ratingLabel,
  textLabel,
  ratingKeys,
  textKeys,
}: {
  response: RetroResponse;
  locale: string;
  planId: string;
  ratingLabel: (key: string) => string;
  textLabel: (key: string) => string;
  ratingKeys: Array<keyof RetroResponse["ratings"]>;
  textKeys: Array<keyof RetroResponse["texts"]>;
}) {
  const written = textKeys.filter((k) => r.texts[k].trim());
  return (
    <li className="rounded-2xl bg-card-soft p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ink-muted">
        <span className="chip bg-card text-ink">{r.allianceTag ? `[${r.allianceTag}]` : "Other / none"}</span>
        {r.verified && (
          <span className="chip bg-success-soft text-success" title="Governor ID confirmed through MightPulse">
            <BadgeCheck className="size-3.5" aria-hidden /> verified
          </span>
        )}
        <span className="chip bg-card text-ink-muted uppercase" dir="ltr">
          {r.locale}
        </span>
        <span className="tabular">{utcLabel(r.createdAt)} UTC</span>
        {r.governorId && (
          <span className="ms-auto font-black text-ink" dir="ltr">
            {r.gameName || "—"} · #{r.governorId}
          </span>
        )}
      </div>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {ratingKeys.map((key) => {
          const value = r.ratings[key];
          return (
            <span key={key} className="chip bg-card text-ink" title={ratingLabel(key)}>
              <span className="text-ink-faint">{key}</span>
              <span className={clsx("tabular", value === undefined ? "text-ink-faint" : value >= 4 ? "text-success" : value <= 1 ? "text-danger" : "")}>
                {value === undefined ? "—" : `${value}/${RATING_MAX}`}
              </span>
            </span>
          );
        })}
      </p>
      {written.length > 0 && (
        <dl className="mt-3 space-y-2">
          {written.map((key) => (
            <div key={key}>
              <dt className="text-xs font-bold tracking-wider text-ink-faint uppercase">{textLabel(key)}</dt>
              <dd className="mt-0.5 text-sm font-semibold wrap-break-word whitespace-pre-wrap text-ink" dir="auto">
                {r.texts[key]}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex justify-end">
        <DeleteForm action={deleteResponse} hidden={{ locale, planId, id: r.id }} confirmText="Delete this response? This cannot be undone." />
      </div>
    </li>
  );
}
