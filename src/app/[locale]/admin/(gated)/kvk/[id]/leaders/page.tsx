import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { LeaderRuleForm } from "@/components/admin/LeaderRuleForm";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { PageBriefForm } from "@/components/admin/PageBriefForm";
import { PendingRefresher } from "@/components/admin/PendingRefresher";
import { PlanEditorTabs } from "@/components/admin/PlanEditorTabs";
import { RallyLeaderForm } from "@/components/admin/RallyLeaderForm";
import { TranslationForm } from "@/components/admin/TranslationForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { HeroAvatar } from "@/components/kvk/HeroAvatar";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { deleteLeaderRule, deleteRallyLeader } from "@/lib/admin/kvk-actions";
import { type AdminLeaderPlan, getLeaderPlanForEditing } from "@/lib/admin/kvk-data";
import { utcLabel } from "@/lib/admin/format";
import { introSourceFor, parseEditLang, TEXT_LIMITS, pendingNote } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getTranslationSettings } from "@/lib/config/settings";
import { getAlliances, getHeroes, getLanguages } from "@/lib/data";
import { pick, type Localized } from "@/lib/i18n/localized";
import { battleMinutes } from "@/lib/kvk/battle-window";
import { ratioLabel } from "@/lib/kvk/formations";
import { latestPetsOffset } from "@/lib/kvk/leaders";

export const metadata: Metadata = { title: "Edit rally leaders" };

/** Real plan ids are rendered on request (Cache Components wants at least one known param). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type LeadersProps = PageProps<"/[locale]/admin/kvk/[id]/leaders">;

const SIDE_LABELS = { attack: "⚔️ Rally", defense: "🛡️ Garrison", any: "Rally or garrison" } as const;
const AUDIENCE_LABELS = { all: "Every leader", rally: "Rally leads", garrison: "Garrison leads" } as const;

/** What the delete action reports through `?error=` (it redirects instead of returning a state). */
const NOTICES: Record<string, string> = {
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

export default async function AdminLeadersPage({ params, searchParams }: LeadersProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <LeadersEditor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LeadersEditor({ locale, params, searchParams }: { locale: string; params: LeadersProps["params"]; searchParams: LeadersProps["searchParams"] }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;
  if (id === "new") notFound();

  const [plan, heroes, alliances, languages] = await Promise.all([getLeaderPlanForEditing(id), getHeroes(), getAlliances(), getLanguages()]);
  if (!plan) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : locale, enabled.map((l) => l.code));
  const heroBySlug = new Map(heroes.map((h) => [h.slug, h]));
  const editorHref = adminPath(locale, `/kvk/${plan.planId}/leaders`);
  const notice = typeof query.error === "string" ? (NOTICES[query.error] ?? "That didn't work. Try again.") : null;
  const latestPets = latestPetsOffset(battleMinutes(plan.battleAt, plan.battleEndAt));

  const header = (
    <>
      <SectionTitle
        icon="👑"
        title={pick(plan.title, "en") || plan.slug}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            <Link href={adminPath(locale, "/kvk")} className="btn-ghost btn-sm">
              ← Back to plans
            </Link>
            <Link href={`/${locale}/kvk/leaders`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="plan-view">
              View page ↗
            </Link>
          </div>
        }
      />
      <PlanEditorTabs locale={locale} planId={plan.planId} current="leaders" />
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
        <EmptyRow>The rally-leader tables are not in the database yet (migration 0010). They arrive with the next database deploy.</EmptyRow>
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
      <p className={`rounded-xl px-3 py-2 text-sm font-bold ${plan.active && plan.brief?.published ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted"}`} data-tour="leaders-status">
        {!plan.brief
          ? "This battle has no rally-leader page yet: set its password below to create it."
          : plan.active && plan.brief.published
            ? "Leaders see this page at /kvk/leaders with their own password; every save reaches them within seconds."
            : plan.active
              ? "The leader page is not published: leaders see “no rally-leader plan yet”."
              : "This plan is not active: leaders see this page once the plan is made active."}
      </p>

      <AdminSection id="leader-page" title="Leader page" hint="Its own password (not the battle plan's) and the instructions above the rallies.">
        <PageBriefForm area="leaders" locale={locale} planId={plan.planId} brief={plan.brief} />
      </AdminSection>

      {plan.brief && (
        <AdminSection
          id="leader-rules"
          tour="leaders-rules"
          title="Leader instructions"
          hint="Do / don't / info lines above the rallies, for every leader or only rally leads or garrison leads: march time, when to start, pets, where to teleport, how to lead."
        >
          {plan.rules.length === 0 ? (
            <EmptyRow>No instructions yet.</EmptyRow>
          ) : (
            <ul className="space-y-3">
              {plan.rules.map((rule, index) => (
                <li key={rule.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-card-soft p-3">
                  <MoveButtons locale={locale} planId={plan.planId} table="kvk_leader_rules" id={rule.id} position={index} count={plan.rules.length} label="instruction" className="self-center" />
                  <LeaderRuleForm locale={locale} planId={plan.planId} rule={rule} />
                  <div className="ms-auto">
                    <DeleteForm action={deleteLeaderRule} hidden={{ locale, planId: plan.planId, id: rule.id }} confirmText="Delete this instruction?" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
            <p className="label">Add an instruction</p>
            <LeaderRuleForm locale={locale} planId={plan.planId} rule={null} />
          </div>
        </AdminSection>
      )}

      {plan.brief && (
        <AdminSection id="rallies" tour="leaders-rallies" title={`Rallies (${plan.rallies.length})`} hint="One entry per rally: which rally, battle team, who leads it, where they stand, when they start, when they use pets, their own heroes and troop ratio.">
          {plan.rallies.length === 0 ? (
            <EmptyRow>No rallies yet.</EmptyRow>
          ) : (
            <ul className="space-y-4">
              {plan.rallies.map((rally, index) => (
                <li key={rally.id} className="flex items-start rounded-2xl bg-card-soft">
                  <MoveButtons locale={locale} planId={plan.planId} table="kvk_rally_leaders" id={rally.id} position={index} count={plan.rallies.length} label="rally" className="ms-3 mt-3" />
                  {/* Collapsed by default, like the formations. */}
                  <details className="group min-w-0 flex-1">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3">
                      <div className="flex gap-2">
                        {rally.heroSlugs.map((slug, i) => (
                          <HeroAvatar
                            key={i}
                            hero={slug ? (heroBySlug.get(slug) ?? null) : null}
                            locale="en"
                            skillLevel={plan.minSkillLevel}
                            anyLabel="Leader's choice"
                            skillTitle="Top expedition skill level"
                          />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-extrabold wrap-break-word text-ink">{pick(rally.target, "en") || "Rally"}</p>
                        <p className="font-semibold wrap-break-word text-ink-muted">
                          {rally.team === "kvk" ? "[KvK]" : "[TMP]"} {rally.name}
                          {rally.allianceTag ? ` (home ${rally.allianceTag})` : ""} · {SIDE_LABELS[rally.side]} · {ratioLabel(rally)}
                          {rally.startAt ? ` · starts ${utcLabel(rally.startAt)} UTC` : ""}
                          {rally.petsOffsetMinutes !== null ? ` · pets +${rally.petsOffsetMinutes} min` : ""}{" "}
                          {!rally.published && <span className="chip ms-1 bg-card text-ink-muted">Hidden</span>}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-ink-faint group-open:hidden">Edit ▾</span>
                      <span className="hidden text-xs font-bold text-ink-faint group-open:inline">Close ▴</span>
                    </summary>
                    <div className="border-t border-line p-3">
                      <RallyLeaderForm locale={locale} planId={plan.planId} rally={rally} heroes={heroes} alliances={alliances} skillLevel={plan.minSkillLevel} latestPetsOffset={latestPets} />
                      <div className="mt-3 flex justify-end">
                        <DeleteForm
                          action={deleteRallyLeader}
                          hidden={{ locale, planId: plan.planId, id: rally.id }}
                          confirmText={`Remove ${rally.name} from the rallies?`}
                        />
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
            <p className="label">Add a rally</p>
            <RallyLeaderForm locale={locale} planId={plan.planId} rally={null} heroes={heroes} alliances={alliances} skillLevel={plan.minSkillLevel} latestPetsOffset={latestPets} />
          </div>
        </AdminSection>
      )}
    </div>
  );
}

/** One language other than English: the leaders' instructions, rally names and notes, each next to the English. */
async function TranslationMode({ plan, locale, lang, langLabel }: { plan: AdminLeaderPlan; locale: string; lang: string; langLabel: string }) {
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

      <AdminSection title="Leader page">
        <TranslationForm
          {...common}
          table="kvk_leader_briefs"
          id={brief.id}
          column="intro"
          label="Instructions for the leaders (Markdown)"
          english={brief.introSource}
          value={introSourceFor(brief, lang)}
          pending={brief.pendingColumns.includes("intro")}
          multiline
          maxLength={TEXT_LIMITS.intro}
        />
      </AdminSection>

      <AdminSection title="Leader instructions">
        {plan.rules.length === 0 ? (
          <EmptyRow>No instructions yet.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {plan.rules.map((rule) => (
              <TranslationForm key={rule.id} {...common} table="kvk_leader_rules" id={rule.id} column="text" label={`Instruction (${AUDIENCE_LABELS[rule.audience]})`} english={text(rule.text, "en")} value={text(rule.text, lang)} pending={rowPending(rule.id, "text")} maxLength={TEXT_LIMITS.text} />
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Rallies">
        {plan.rallies.length === 0 ? (
          <EmptyRow>No rallies yet.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {plan.rallies.flatMap((r) => [
              <TranslationForm key={`${r.id}-target`} {...common} table="kvk_rally_leaders" id={r.id} column="target" label={`Rally led by ${r.name}`} english={text(r.target, "en")} value={text(r.target, lang)} pending={rowPending(r.id, "target")} maxLength={TEXT_LIMITS.target} />,
              ...(text(r.position, "en").trim()
                ? [<TranslationForm key={`${r.id}-position`} {...common} table="kvk_rally_leaders" id={r.id} column="position" label={`Position of ${r.name}`} english={text(r.position, "en")} value={text(r.position, lang)} pending={rowPending(r.id, "position")} maxLength={TEXT_LIMITS.position} />]
                : []),
              ...(text(r.note, "en").trim()
                ? [<TranslationForm key={`${r.id}-note`} {...common} table="kvk_rally_leaders" id={r.id} column="note" label={`Note for ${r.name}`} english={text(r.note, "en")} value={text(r.note, lang)} pending={rowPending(r.id, "note")} maxLength={TEXT_LIMITS.note} />]
                : []),
            ])}
          </div>
        )}
      </AdminSection>
    </>
  );
}
