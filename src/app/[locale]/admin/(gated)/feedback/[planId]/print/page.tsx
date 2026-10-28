import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { AllianceTable } from "@/components/admin/AllianceTable";
import { PrintButton } from "@/components/admin/PrintButton";
import { utcLabel } from "@/lib/admin/format";
import { getRetrospectiveByPlan, listResponses } from "@/lib/admin/retro-data";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import type { RetroResponse } from "@/lib/data/types";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";
import { hasText } from "@/lib/retro/analysis";
import { RATING_MAX, RATING_MIN, shownRatings, shownTexts } from "@/lib/retro/questions";
import { parseResultsView, withView } from "@/lib/retro/results-view";
import { formatAverage, overallAverage, summarizeByAlliance, summarizeRatings } from "@/lib/retro/summary";

export const metadata: Metadata = { title: "Print feedback" };

type PrintProps = PageProps<"/[locale]/admin/feedback/[planId]/print">;

/** Token scopes in globals.css (plain CSS, like the layout's font classes): the light or dark palette on the printed sheet. */
const PAPER_CLASS = { light: "paper-light", dark: "paper-dark" };

/**
 * The paper of the whole sheet, margins included, whatever the site theme: `@page` and the root can't be scoped to an
 * element, so the page brings its own rule. The theme script sets color-scheme inline on <html> (hence !important; a
 * dark scheme would print dark margins around light paper), and dark paper keeps its colours on the root too, or the
 * browser leaves the page background out.
 */
const PAGE_CSS = {
  light: "@media print { html { color-scheme: light !important; background: #ffffff; } @page { background: #ffffff; } }",
  dark: "@media print { html { color-scheme: dark !important; background: #0f1627; -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { background: #0f1627; } }",
};

/**
 * Every answer of a battle on one page, laid out for paper: the browser's print
 * dialog turns it into a PDF. Names follow the results page: the owner sees them
 * unless they hid them, everyone else never gets them. The site and admin bars,
 * and the toolbar here, are left off the paper (`print:hidden`).
 */
export default async function FeedbackPrintPage({ params, searchParams }: PrintProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <PrintView locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PrintView({ locale, params, searchParams }: { locale: string; params: PrintProps["params"]; searchParams: PrintProps["searchParams"] }) {
  const [{ planId }, query] = await Promise.all([params, searchParams]);
  const user = await requireEditor(locale);
  if (!user) return null;
  const retro = await getRetrospectiveByPlan(planId);
  if (!retro) notFound();
  const view = parseResultsView(query);
  const showNames = user.isOwner && !view.namesHidden;
  const [responses, en] = await Promise.all([listResponses(retro.id, { identity: showNames }), getDictionary("en")]);

  const ratings = shownRatings(retro.config);
  const texts = shownTexts(retro.config);
  const ratingKeys = ratings.map((q) => q.key);
  const summaries = summarizeRatings(responses, ratingKeys);
  const byAlliance = summarizeByAlliance(responses, ratingKeys);
  const labelOf = (key: string) => en[(ratings.find((q) => q.key === key) ?? texts.find((t) => t.key === key))!.labelKey];
  const title = pick(retro.plan.title, "en") || retro.plan.slug;
  const base = adminPath(locale, `/feedback/${retro.planId}`);
  const analysis = retro.analysis;

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center gap-x-2 gap-y-3 p-4 print:hidden" data-tour="print-toolbar">
        <Link href={withView(base, { ...view, darkPaper: false })} className="btn-ghost btn-sm">
          ← Back to results
        </Link>
        {user.isOwner && (
          <Link href={withView(`${base}/print`, { ...view, namesHidden: !view.namesHidden })} className="btn-ghost btn-sm" scroll={false} data-tour="print-names">
            {view.namesHidden ? "Show names" : "Hide names"}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Paper" data-tour="print-paper">
          <span className="text-sm font-bold text-ink-muted">Paper</span>
          {[false, true].map((dark) =>
            dark === view.darkPaper ? (
              <span key={String(dark)} className="btn-primary btn-sm" aria-current="true">
                {dark ? "Dark" : "Light"}
              </span>
            ) : (
              <Link key={String(dark)} href={withView(`${base}/print`, { ...view, darkPaper: dark })} className="btn-ghost btn-sm" scroll={false}>
                {dark ? "Dark" : "Light"}
              </Link>
            ),
          )}
        </div>
        <PrintButton />
        <p className="basis-full text-sm font-semibold text-ink-muted">
          Every answer on one page, laid out for paper. To get a file, pick &ldquo;Save as PDF&rdquo; as the printer in the print dialog. Paper only changes the printout:
          Dark gives a PDF for reading on a screen, keep Light for a printer.{" "}
          {showNames ? "Names and Governor IDs are on it: hide them before you share it." : user.isOwner ? "Names are hidden." : "Names are never shown here (owner only)."}
        </p>
      </div>

      <style>{view.darkPaper ? PAGE_CSS.dark : PAGE_CSS.light}</style>
      {/* The paper palette applies to the printout only; on screen the sheet follows the site theme. */}
      <article
        className={clsx(
          "card space-y-6 p-5 text-ink print:space-y-5 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none",
          view.darkPaper ? PAPER_CLASS.dark : PAPER_CLASS.light,
        )}
        data-tour="print-sheet"
      >
        <header className="border-b border-line pb-3">
          <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">Battle feedback · {retro.plan.eventType === "kvk" ? "KvK" : "Castle battle"}</p>
          <h1 className="mt-1 text-2xl font-black wrap-break-word">{title}</h1>
          <p className="mt-1 text-sm font-semibold text-ink-muted">
            Battle {retro.plan.battleAt ? `${utcLabel(retro.plan.battleAt)} UTC` : "date not set"} · {responses.length} response{responses.length === 1 ? "" : "s"} ·{" "}
            {retro.open ? "form still open" : "form closed"}
          </p>
          {showNames && <p className="mt-1 text-xs font-bold text-danger">Contains names and Governor IDs. Keep it within the council.</p>}
        </header>

        {responses.length === 0 ? (
          <p className="text-sm font-semibold text-ink-muted">No responses yet.</p>
        ) : (
          <section className="space-y-3">
            <h2 className="break-after-avoid text-lg font-extrabold">Summary</h2>
            <p className="text-sm font-semibold text-ink-muted">
              Overall mood <span className="font-black text-ink tabular">{formatAverage(overallAverage(summaries))} / 5</span> · {responses.filter((r) => r.verified).length} with a
              verified Governor ID · {responses.filter(hasText).length} with written feedback
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-ink-faint">
                    <th className="py-1 text-start font-bold">Question</th>
                    <th className="py-1 text-end font-bold">Average</th>
                    <th className="py-1 text-end font-bold">Answers</th>
                    {summaries[0]?.distribution.map((_, i) => (
                      <th key={i} className="py-1 text-end font-bold tabular">
                        {RATING_MIN + i}★
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.key} className="border-t border-line">
                      <td className="py-1.5 pe-3 font-bold">{labelOf(s.key)}</td>
                      <td className="py-1.5 text-end font-black tabular">{formatAverage(s.average)}</td>
                      <td className="py-1.5 text-end tabular">{s.count}</td>
                      {s.distribution.map((n, i) => (
                        <td key={i} className="py-1.5 text-end text-ink-muted tabular">
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {byAlliance.length > 1 && <AllianceTable groups={byAlliance} keys={ratingKeys} labelOf={labelOf} />}
          </section>
        )}

        {analysis && (
          <section className="break-inside-avoid space-y-3">
            <h2 className="break-after-avoid text-lg font-extrabold">AI summary</h2>
            <p className="text-sm font-semibold wrap-break-word">
              <span className="font-black tabular">Mood {formatAverage(analysis.mood)} / 5.</span> {analysis.summary}
            </p>
            {analysis.themes.length > 0 && (
              <div>
                <p className="label">Recurring themes</p>
                <ul className="space-y-1.5 text-sm">
                  {analysis.themes.map((theme, i) => (
                    <li key={i} className="wrap-break-word">
                      <span className="font-extrabold">{theme.title}</span> <span className="text-xs font-bold text-ink-faint tabular">× {theme.count}</span>{" "}
                      <span className="text-xs font-bold text-ink-muted">({labelOf(theme.prompt)})</span>
                      {theme.quote && (
                        <q className="block font-semibold text-ink-muted" dir="auto">
                          {theme.quote}
                        </q>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.actions.length > 0 && (
              <div>
                <p className="label">Suggested actions</p>
                <ol className="list-decimal space-y-1 ps-5 text-sm font-semibold">
                  {analysis.actions.map((action, i) => (
                    <li key={i} className="wrap-break-word">
                      {action}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <p className="text-xs font-semibold text-ink-faint">
              Analysed {retro.analysisCount ?? "?"} responses{retro.analysisAt && ` on ${utcLabel(retro.analysisAt)} UTC`}.
            </p>
          </section>
        )}

        {responses.length > 0 && (
          <section className="space-y-3">
            <h2 className="break-after-avoid text-lg font-extrabold">Responses ({responses.length}, newest first)</h2>
            <ol className="space-y-2">
              {responses.map((r, i) => (
                <PrintedResponse key={r.id} number={i + 1} response={r} ratingKeys={ratingKeys} textKeys={texts.map((t) => t.key)} labelOf={labelOf} />
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}

function PrintedResponse({
  number,
  response: r,
  ratingKeys,
  textKeys,
  labelOf,
}: {
  number: number;
  response: RetroResponse;
  ratingKeys: Array<keyof RetroResponse["ratings"]>;
  textKeys: Array<keyof RetroResponse["texts"]>;
  labelOf: (key: string) => string;
}) {
  const written = textKeys.filter((k) => r.texts[k].trim());
  return (
    <li className="break-inside-avoid rounded-xl border border-line bg-card px-3 py-2">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs font-bold text-ink-muted">
        <span className="font-black text-ink tabular">{number}.</span>
        <span className="text-ink">{r.allianceTag ? `[${r.allianceTag}]` : "Other / none"}</span>
        {r.verified && <span className="text-success">✓ verified</span>}
        <span className="uppercase" dir="ltr">
          {r.locale}
        </span>
        <span className="tabular">{utcLabel(r.createdAt)} UTC</span>
        {r.governorId && (
          <span className="ms-auto font-black text-ink" dir="ltr">
            {r.gameName || "—"} · #{r.governorId}
          </span>
        )}
      </p>
      <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-bold">
        {ratingKeys.map((key) => {
          const value = r.ratings[key];
          return (
            <span key={key} title={labelOf(key)}>
              <span className="text-ink-faint">{key}</span>{" "}
              <span className={clsx("tabular", value === undefined ? "text-ink-faint" : value >= 4 ? "text-success" : value <= 1 ? "text-danger" : "text-ink")}>
                {value === undefined ? "—" : `${value}/${RATING_MAX}`}
              </span>
            </span>
          );
        })}
      </p>
      {written.length > 0 && (
        <dl className="mt-2 space-y-1.5">
          {written.map((key) => {
            const original = r.texts[key];
            const english = r.textsEn?.[key]?.trim() ?? "";
            const translated = english !== "" && english !== original.trim();
            return (
              <div key={key}>
                <dt className="text-[0.6875rem] font-bold tracking-wider text-ink-faint uppercase">{labelOf(key)}</dt>
                <dd className="text-sm font-semibold wrap-break-word whitespace-pre-wrap" dir={translated ? "ltr" : "auto"}>
                  {translated ? english : original}
                </dd>
                {translated && (
                  <dd className="mt-0.5 text-xs font-semibold wrap-break-word whitespace-pre-wrap text-ink-muted">
                    Original ({r.locale}): <span dir="auto">{original}</span>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      )}
    </li>
  );
}
