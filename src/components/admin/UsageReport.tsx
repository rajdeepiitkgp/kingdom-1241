import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { utcLabel } from "@/lib/admin/format";
import type { UsageData } from "@/lib/admin/usage-data";
import { adminPath } from "@/lib/auth/paths";
import { type Check, formatBytes, type Level, LINKS, verdictLine } from "@/lib/usage/health";
import { AdminSection } from "./ui";

/** The owner's Usage tab: one verdict, then every measure with what it means and where to act. */

const LEVELS: Record<Level, { label: string; chip: string; bar: string; dot: string }> = {
  ok: { label: "Fine", chip: "bg-success-soft text-success", bar: "bg-success", dot: "bg-success" },
  watch: { label: "Watch", chip: "bg-gold-soft text-gold-ink", bar: "bg-gold", dot: "bg-gold" },
  act: { label: "Act now", chip: "bg-danger-soft text-danger", bar: "bg-danger", dot: "bg-danger" },
  unknown: { label: "Unknown", chip: "bg-card-soft text-ink-muted", bar: "bg-ink-faint", dot: "bg-ink-faint" },
};

const VERDICT_ICON = { ok: "✅", watch: "🟡", act: "🔴" } as const;

function Destination({ link, locale }: { link: NonNullable<Check["link"]>; locale: string }) {
  if (link.href.startsWith("/")) {
    return (
      <Link href={adminPath(locale, link.href)} className="font-bold text-primary underline underline-offset-2">
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-2">
      {link.label}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

function CheckRow({ check, locale }: { check: Check; locale: string }) {
  const level = LEVELS[check.level];
  return (
    <li className="flex gap-3 py-3">
      <span className={clsx("mt-1.5 size-2.5 shrink-0 rounded-full", level.dot)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="font-bold text-ink">{check.title}</span>
          <span className={clsx("chip", level.chip)}>{level.label}</span>
        </p>
        <p className="text-sm font-semibold text-ink tabular">{check.value}</p>
        {check.share !== undefined && (
          <div className="h-1.5 overflow-hidden rounded-full bg-card-soft" aria-hidden>
            <div className={clsx("h-full rounded-full", level.bar)} style={{ width: `${Math.min(100, Math.max(1, check.share * 100))}%` }} />
          </div>
        )}
        <p className="text-xs text-ink-muted">{check.detail}</p>
        {check.link && (
          <p className="text-xs">
            <Destination link={check.link} locale={locale} />
          </p>
        )}
      </div>
    </li>
  );
}

export function UsageReport({ data, locale }: { data: UsageData; locale: string }) {
  const { report, verdict } = data;
  return (
    <div className="space-y-6">
      <section
        className={clsx(
          "card space-y-2 p-5",
          verdict.level === "act" && "ring-2 ring-danger/40",
          verdict.level === "watch" && "ring-2 ring-gold/40",
        )}
        data-tour="settings-usage-verdict"
      >
        <p className="text-xl font-black text-ink">
          <span aria-hidden>{VERDICT_ICON[verdict.level]}</span> {verdictLine(verdict)}
        </p>
        {verdict.act.length > 0 && <p className="text-sm font-bold text-danger">Needs action: {verdict.act.map((check) => check.title).join(", ")}.</p>}
        {verdict.watch.length > 0 && <p className="text-sm font-bold text-gold-ink">To watch: {verdict.watch.map((check) => check.title).join(", ")}.</p>}
        <p className="text-xs text-ink-faint">Measured {utcLabel(data.checkedAt)} UTC. Reload the page for fresh numbers.</p>
      </section>

      <AdminSection title="Database (Supabase free plan)" tour="settings-usage-database">
        <ul className="divide-y divide-line">
          {report.database.map((check) => (
            <CheckRow key={check.id} check={check} locale={locale} />
          ))}
        </ul>
        {report.tables.length > 0 && (
          <details className="mt-2 rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-bold text-ink">All tables, biggest first</summary>
            <ul className="mt-2 divide-y divide-line text-sm">
              {report.tables.map((table) => (
                <li key={table.name} className="flex flex-wrap justify-between gap-x-3 py-1.5">
                  <span className="min-w-0 font-semibold break-all text-ink" dir="ltr">
                    {table.name}
                  </span>
                  <span className="text-ink-muted tabular">
                    {formatBytes(table.bytes)} · {table.rows.toLocaleString("en")} rows
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </AdminSection>

      <AdminSection title="Live use and background jobs" tour="settings-usage-jobs">
        <ul className="divide-y divide-line">
          {report.jobs.map((check) => (
            <CheckRow key={check.id} check={check} locale={locale} />
          ))}
        </ul>
      </AdminSection>

      <AdminSection
        title="Measured elsewhere"
        tour="settings-usage-elsewhere"
        hint="These only the providers' dashboards know; the site has no key for them. Worth a look once a week, and whenever their e-mails warn you."
      >
        <ul className="space-y-3 text-sm">
          <li>
            <p className="font-bold text-ink">Vercel (Hobby plan)</p>
            <p className="text-ink-muted">Active CPU (4 hours a month), ISR writes (200,000), Fast Data Transfer (100 GB) and Deployment Storage (10 GB, kept low by the Prune deployments workflow).</p>
            <p className="text-xs">
              <Destination link={{ label: "Vercel usage", href: LINKS.vercelUsage }} locale={locale} />
            </p>
          </li>
          <li>
            <p className="font-bold text-ink">Supabase (free plan)</p>
            <p className="text-ink-muted">Egress (5 GB a month), Realtime messages (2 million) and peak connections (200), sign-ins.</p>
            <p className="text-xs">
              <Destination link={{ label: "Supabase usage", href: LINKS.supabaseUsage }} locale={locale} />
            </p>
          </li>
          <li>
            <p className="font-bold text-ink">AI (Anthropic)</p>
            <p className="text-ink-muted">What machine translation and the feedback summaries cost; set a monthly limit there.</p>
            <p className="text-xs">
              <Destination link={{ label: "Anthropic usage", href: LINKS.anthropicUsage }} locale={locale} />
            </p>
          </li>
        </ul>
      </AdminSection>
    </div>
  );
}

/** The owner's line on the admin Overview: the verdict, one tap from the tab. */
export function UsageSummary({ data, locale }: { data: UsageData; locale: string }) {
  const { verdict } = data;
  const names = [...verdict.act, ...verdict.watch].map((check) => check.title);
  return (
    <Link
      href={adminPath(locale, "/settings/usage")}
      className={clsx(
        "card flex items-center gap-3 p-4 transition-colors hover:bg-card-soft",
        verdict.level === "act" && "ring-2 ring-danger/40",
        verdict.level === "watch" && "ring-2 ring-gold/40",
      )}
      data-tour="admin-usage"
    >
      <span className="text-xl" aria-hidden>
        {VERDICT_ICON[verdict.level]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-ink">Usage: {verdictLine(verdict)}</span>
        {names.length > 0 && <span className="block text-sm text-ink-muted">{names.join(", ")}</span>}
      </span>
      <span className="btn-ghost btn-sm shrink-0">Open</span>
    </Link>
  );
}
