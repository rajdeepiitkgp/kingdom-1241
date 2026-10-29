import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ChecklistItemForm } from "@/components/admin/ChecklistItemForm";
import { ChecklistRuleForm } from "@/components/admin/ChecklistRuleForm";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { PageBriefForm } from "@/components/admin/PageBriefForm";
import { PendingRefresher } from "@/components/admin/PendingRefresher";
import { PlanEditorTabs } from "@/components/admin/PlanEditorTabs";
import { TranslationForm } from "@/components/admin/TranslationForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { deleteChecklistItem, deleteChecklistRule } from "@/lib/admin/kvk-actions";
import { type AdminChecklistPlan, getChecklistPlanForEditing } from "@/lib/admin/kvk-data";
import { introSourceFor, parseEditLang, TEXT_LIMITS, pendingNote } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getTranslationSettings } from "@/lib/config/settings";
import { getLanguages } from "@/lib/data";
import { pick, type Localized } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit commander checklist" };

/** Real plan ids are rendered on request (Cache Components wants at least one known param). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type ChecklistProps = PageProps<"/[locale]/admin/kvk/[id]/checklist">;

const PHASE_LABELS = { before: "Before battle day", day: "Battle day", during: "During", after: "After" } as const;
const SECTION_LABELS = { commander: "Commander's orders", general: "General guideline" } as const;

/** What the delete action reports through `?error=` (it redirects instead of returning a state). */
const NOTICES: Record<string, string> = {
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

export default async function AdminChecklistPage({ params, searchParams }: ChecklistProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <ChecklistEditor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ChecklistEditor({
  locale,
  params,
  searchParams,
}: {
  locale: string;
  params: ChecklistProps["params"];
  searchParams: ChecklistProps["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;
  if (id === "new") notFound();

  const [plan, languages] = await Promise.all([getChecklistPlanForEditing(id), getLanguages()]);
  if (!plan) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : locale, enabled.map((l) => l.code));
  const editorHref = adminPath(locale, `/kvk/${plan.planId}/checklist`);
  const notice = typeof query.error === "string" ? (NOTICES[query.error] ?? "That didn't work. Try again.") : null;

  const header = (
    <>
      <SectionTitle
        icon="🎖️"
        title={pick(plan.title, "en") || plan.slug}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            <Link href={adminPath(locale, "/kvk")} className="btn-ghost btn-sm">
              ← Back to plans
            </Link>
            <Link href={`/${locale}/kvk/checklist`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="plan-view">
              View page ↗
            </Link>
          </div>
        }
      />
      <PlanEditorTabs locale={locale} planId={plan.planId} current="checklist" />
      {plan.available && plan.brief && <LanguagePicker languages={enabled} current={lang} href={editorHref} />}
      {notice && (
        <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {notice}
        </p>
      )}
    </>
  );

  if (!plan.available) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyRow>The checklist tables are not in the database yet (migration 0011). They arrive with the next database deploy.</EmptyRow>
      </div>
    );
  }

  if (lang !== "en" && plan.brief) {
    const language = enabled.find((l) => l.code === lang)!;
    return (
      <div className="space-y-6">
        {header}
        <TranslationMode key={lang} plan={plan} locale={locale} lang={lang} langLabel={language.nativeName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <p className={`rounded-xl px-3 py-2 text-sm font-bold ${plan.active && plan.brief?.published ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted"}`} data-tour="checklist-status">
        {!plan.brief
          ? "This battle has no commander checklist yet: set its password below to create it."
          : plan.active && plan.brief.published
            ? "The commander and coordinators see this page at /kvk/checklist with its own password; every save reaches them within seconds."
            : plan.active
              ? "The checklist is not published: visitors see “no commander checklist yet”."
              : "This plan is not active: the checklist shows once the plan is made active."}
      </p>

      <AdminSection id="checklist-page" title="Checklist page" hint="Its own password (not the battle plan's or the leaders') and the commander's brief above the checklist.">
        <PageBriefForm area="checklist" locale={locale} planId={plan.planId} brief={plan.brief} />
      </AdminSection>

      {plan.brief && (
        <AdminSection
          id="checklist-items"
          tour="checklist-items"
          title={`Checklist (${plan.items.length})`}
          hint="Everything that has to be done, by phase: before battle day, on battle day before the start, during and after the battle. The page groups the tasks by phase in this order; the commander ticks them off on their own device."
        >
          {plan.items.length === 0 ? (
            <EmptyRow>No tasks yet.</EmptyRow>
          ) : (
            <ul className="space-y-3">
              {plan.items.map((item, index) => (
                <li key={item.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-card-soft p-3">
                  <MoveButtons locale={locale} planId={plan.planId} table="kvk_checklist_items" id={item.id} position={index} count={plan.items.length} label="task" className="self-center" />
                  <ChecklistItemForm locale={locale} planId={plan.planId} item={item} />
                  <div className="ms-auto">
                    <DeleteForm action={deleteChecklistItem} hidden={{ locale, planId: plan.planId, id: item.id }} confirmText="Delete this task?" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
            <p className="label">Add a task</p>
            <ChecklistItemForm locale={locale} planId={plan.planId} item={null} />
          </div>
        </AdminSection>
      )}

      {plan.brief && (
        <AdminSection
          id="checklist-rules"
          tour="checklist-rules"
          title="Commander's orders and guidelines"
          hint="Do / don't / info lines below the checklist: how the battle commander runs the battle and directs rally leaders and joiners, and the general guidelines for everyone who coordinates."
        >
          {plan.rules.length === 0 ? (
            <EmptyRow>No lines yet.</EmptyRow>
          ) : (
            <ul className="space-y-3">
              {plan.rules.map((rule, index) => (
                <li key={rule.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-card-soft p-3">
                  <MoveButtons locale={locale} planId={plan.planId} table="kvk_checklist_rules" id={rule.id} position={index} count={plan.rules.length} label="line" className="self-center" />
                  <ChecklistRuleForm locale={locale} planId={plan.planId} rule={rule} />
                  <div className="ms-auto">
                    <DeleteForm action={deleteChecklistRule} hidden={{ locale, planId: plan.planId, id: rule.id }} confirmText="Delete this line?" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
            <p className="label">Add a line</p>
            <ChecklistRuleForm locale={locale} planId={plan.planId} rule={null} />
          </div>
        </AdminSection>
      )}
    </div>
  );
}

/** One language other than English: the commander's brief, the tasks and the lines, each next to the English. */
async function TranslationMode({ plan, locale, lang, langLabel }: { plan: AdminChecklistPlan; locale: string; lang: string; langLabel: string }) {
  const brief = plan.brief!;
  const common = { locale, planId: plan.planId, lang, langLabel };
  const text = (value: Localized | undefined, code: string) => (typeof value?.[code] === "string" ? value[code] : "");
  const anyPending = brief.pendingColumns.length > 0 || Object.keys(plan.pendingRows).length > 0;
  const { paused } = await getTranslationSettings();
  const rowPending = (id: string, column: string) => (plan.pendingRows[id] ?? []).includes(column);

  return (
    <>
      <PendingRefresher active={anyPending && !paused} />
      <p className="rounded-xl bg-card-soft px-3 py-2 text-sm font-bold text-ink-muted">
        Corrections saved here apply to {langLabel} only and are never overwritten until the English text changes again.
        {anyPending && pendingNote(paused)}
      </p>

      <AdminSection title="Checklist page">
        <TranslationForm
          {...common}
          table="kvk_checklist_briefs"
          id={brief.id}
          column="intro"
          label="Commander's brief (Markdown)"
          english={brief.introSource}
          value={introSourceFor(brief, lang)}
          pending={brief.pendingColumns.includes("intro")}
          multiline
          markdown
          maxLength={TEXT_LIMITS.intro}
        />
      </AdminSection>

      <AdminSection title="Checklist">
        {plan.items.length === 0 ? (
          <EmptyRow>No tasks yet.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {plan.items.flatMap((item) => [
              <TranslationForm key={`${item.id}-text`} {...common} table="kvk_checklist_items" id={item.id} column="text" label={`Task (${PHASE_LABELS[item.phase]})`} english={text(item.text, "en")} value={text(item.text, lang)} pending={rowPending(item.id, "text")} maxLength={TEXT_LIMITS.text} />,
              ...(text(item.note, "en").trim()
                ? [<TranslationForm key={`${item.id}-note`} {...common} table="kvk_checklist_items" id={item.id} column="note" label="Note on the task above" english={text(item.note, "en")} value={text(item.note, lang)} pending={rowPending(item.id, "note")} maxLength={TEXT_LIMITS.note} />]
                : []),
            ])}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Commander's orders and guidelines">
        {plan.rules.length === 0 ? (
          <EmptyRow>No lines yet.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {plan.rules.map((rule) => (
              <TranslationForm key={rule.id} {...common} table="kvk_checklist_rules" id={rule.id} column="text" label={SECTION_LABELS[rule.section]} english={text(rule.text, "en")} value={text(rule.text, lang)} pending={rowPending(rule.id, "text")} maxLength={TEXT_LIMITS.text} />
            ))}
          </div>
        )}
      </AdminSection>
    </>
  );
}
