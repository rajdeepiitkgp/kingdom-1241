import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { CoordinatorForm } from "@/components/admin/CoordinatorForm";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { FormationForm } from "@/components/admin/FormationForm";
import { PlanForm } from "@/components/admin/PlanForm";
import { RetroSettingsForm } from "@/components/admin/RetroSettingsForm";
import { RuleForm } from "@/components/admin/RuleForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { HeroAvatar } from "@/components/kvk/HeroAvatar";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { deleteCoordinator, deleteFormation, deleteRule } from "@/lib/admin/kvk-actions";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { PendingRefresher } from "@/components/admin/PendingRefresher";
import { PlanEditorTabs } from "@/components/admin/PlanEditorTabs";
import { TranslationForm } from "@/components/admin/TranslationForm";
import { getPlanForEditing, type AdminKvkPlan } from "@/lib/admin/kvk-data";
import { type AdminRetrospective, getRetrospectiveByPlan } from "@/lib/admin/retro-data";
import { utcLabel } from "@/lib/admin/format";
import { introSourceFor, parseEditLang, TEXT_LIMITS, pendingNote } from "@/lib/admin/translation";
import { MAX_FORMATIONS, nextFreeLabel } from "@/lib/admin/kvk-forms";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getFeedbackDefaults, getTranslationSettings } from "@/lib/config/settings";
import { getAlliances, getHeroes, getLanguages } from "@/lib/data";
import type { FormationRole, FormationSide } from "@/lib/data/types";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick, type Localized } from "@/lib/i18n/localized";
import { ratioLabel } from "@/lib/kvk/formations";
import { RATING_QUESTIONS, TEXT_PROMPTS } from "@/lib/retro/questions";

export const metadata: Metadata = { title: "Edit battle plan" };

/** "new" is the only id known in advance; real plan ids are rendered on request (Cache Components wants at least one). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

const SIDE_LABELS: Record<FormationSide, string> = { attack: "⚔️ Attack", defense: "🛡️ Defence", any: "Attack or defence" };
/** Attackers rally, defenders garrison; the database keeps rally_lead / rally_join for both. */
function roleLabel(side: FormationSide, role: FormationRole): string {
  if (role === "any") return "any role";
  const word = side === "attack" ? "rally" : side === "defense" ? "garrison" : "rally or garrison";
  return `${word} ${role === "rally_lead" ? "leader" : "joiner"}`;
}

type EditorProps = PageProps<"/[locale]/admin/kvk/[id]">;

/** What the delete actions report through `?error=` when they can't return a state (they redirect). */
const EDITOR_NOTICES: Record<string, string> = {
  forbidden: "You don't have permission for that.",
  delete: "Deleting failed. Try again in a moment.",
};

export default async function AdminPlanEditorPage({ params, searchParams }: EditorProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <PlanEditor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanEditor({
  locale,
  params,
  searchParams,
}: {
  locale: string;
  params: EditorProps["params"];
  searchParams: EditorProps["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;

  if (id === "new") {
    return (
      <div className="space-y-5">
        <SectionTitle
          icon="⚔️"
          title="New battle plan"
          action={
            <Link href={adminPath(locale, "/kvk")} className="btn-ghost btn-sm">
              ← Back to plans
            </Link>
          }
        />
        <p className="text-sm font-semibold text-ink-muted">
          Fill in the basics first; the instructions, coordinators and formations are added on the next screen. Tip: duplicating
          the current plan from the plan list is usually faster.
        </p>
        <PlanForm plan={null} locale={locale} />
      </div>
    );
  }

  const [plan, heroes, alliances, languages, retro, en, feedbackDefaults] = await Promise.all([
    getPlanForEditing(id),
    getHeroes(),
    getAlliances(),
    getLanguages(),
    getRetrospectiveByPlan(id),
    getDictionary("en"),
    getFeedbackDefaults(),
  ]);
  if (!plan) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : locale, enabled.map((l) => l.code));
  const freeLabel = nextFreeLabel(plan.formations.map((f) => f.label));
  const heroBySlug = new Map(heroes.map((h) => [h.slug, h]));
  const editorHref = adminPath(locale, `/kvk/${plan.id}`);
  const notice = typeof query.error === "string" ? (EDITOR_NOTICES[query.error] ?? "That didn't work. Try again.") : null;

  const header = (
    <>
      <SectionTitle
        icon="⚔️"
        title={pick(plan.title, "en") || plan.slug}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            <Link href={adminPath(locale, "/kvk")} className="btn-ghost btn-sm">
              ← Back to plans
            </Link>
            <Link href={`/${locale}/kvk`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="plan-view">
              View page ↗
            </Link>
          </div>
        }
      />
      <PlanEditorTabs locale={locale} planId={plan.id} current="plan" />
      <LanguagePicker languages={enabled} current={lang} href={editorHref} />
      {notice && (
        <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {notice}
        </p>
      )}
    </>
  );

  if (lang !== "en") {
    const language = enabled.find((l) => l.code === lang)!;
    return (
      <div className="space-y-6">
        {header}
        {/* Keyed by language: the forms are uncontrolled, so a client-side switch must remount them with that language's text. */}
        <TranslationMode key={lang} plan={plan} retro={retro} locale={locale} lang={lang} langLabel={language.nativeName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      <p className={`rounded-xl px-3 py-2 text-sm font-bold ${plan.active ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted"}`} data-tour="plan-status">
        {plan.active
          ? "This is the active plan: every save reaches players within seconds (translations follow shortly after)."
          : "This plan is not active: players don't see it until you tick “Active” and save."}
        {" "}Texts you change here are re-translated into every language; to correct one translation, pick its language above.
      </p>

      <PlanForm plan={plan} locale={locale} />

      <AdminSection id="rules" tour="plan-rules" title="Battle-day instructions" hint="Short do / don't / info lines, shown as a checklist above the formations.">
        {plan.rules.length === 0 ? (
          <EmptyRow>No instructions yet.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {plan.rules.map((rule, index) => (
              <li key={rule.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-card-soft p-3">
                <MoveButtons locale={locale} planId={plan.id} table="kvk_rules" id={rule.id} position={index} count={plan.rules.length} label="instruction" className="self-center" />
                <RuleForm locale={locale} planId={plan.id} rule={rule} />
                <div className="ms-auto">
                  <DeleteForm action={deleteRule} hidden={{ locale, planId: plan.id, id: rule.id }} confirmText="Delete this instruction?" />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
          <p className="label">Add an instruction</p>
          <RuleForm locale={locale} planId={plan.id} rule={null} />
        </div>
      </AdminSection>

      <AdminSection id="coordinators" tour="plan-coordinators" title="Coordinators" hint="Who players listen to on battle day. [KvK] rallies the castle, [TMP] counter-rallies.">
        {plan.coordinators.length === 0 ? (
          <EmptyRow>No coordinators yet.</EmptyRow>
        ) : (
          <ul className="space-y-3">
            {plan.coordinators.map((coordinator, index) => (
              <li key={coordinator.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-card-soft p-3">
                <MoveButtons locale={locale} planId={plan.id} table="kvk_coordinators" id={coordinator.id} position={index} count={plan.coordinators.length} label="coordinator" className="self-center" />
                <CoordinatorForm locale={locale} planId={plan.id} coordinator={coordinator} alliances={alliances} />
                <div className="ms-auto">
                  <DeleteForm
                    action={deleteCoordinator}
                    hidden={{ locale, planId: plan.id, id: coordinator.id }}
                    confirmText={`Remove ${coordinator.name} from the coordinators?`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
          <p className="label">Add a coordinator</p>
          <CoordinatorForm locale={locale} planId={plan.id} coordinator={null} alliances={alliances} />
        </div>
      </AdminSection>

      <AdminSection
        id="formations"
        tour="plan-formations"
        title={`Formations (${plan.formations.length} of ${MAX_FORMATIONS})`}
        hint="One entry per troop-ratio preset players save in the game. Leave a hero slot on “Any hero” when players may choose."
      >
        {plan.formations.length === 0 ? (
          <EmptyRow>No formations yet.</EmptyRow>
        ) : (
          <ul className="space-y-4">
            {plan.formations.map((formation, index) => (
              <li key={formation.id} className="flex items-start rounded-2xl bg-card-soft">
                <MoveButtons locale={locale} planId={plan.id} table="kvk_formations" id={formation.id} position={index} count={plan.formations.length} label="formation" className="ms-3 mt-3" />
                {/* Collapsed by default: twelve open forms would make the page endless. */}
                <details className="group min-w-0 flex-1">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold text-lg font-black text-gold-ink">{formation.label}</span>
                    <div className="flex gap-2">
                      {formation.heroSlugs.map((slug, i) => (
                        <HeroAvatar
                          key={i}
                          hero={slug ? (heroBySlug.get(slug) ?? null) : null}
                          locale="en"
                          skillLevel={plan.minSkillLevel}
                          anyLabel="Any hero"
                          skillTitle="Top expedition skill level"
                        />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1 text-sm font-semibold text-ink-muted">
                      {SIDE_LABELS[formation.side]} · {roleLabel(formation.side, formation.role)} · {ratioLabel(formation)}{" "}
                      {!formation.published && <span className="chip ms-1 bg-card text-ink-muted">Hidden</span>}
                    </div>
                    <span className="text-xs font-bold text-ink-faint group-open:hidden">Edit ▾</span>
                    <span className="hidden text-xs font-bold text-ink-faint group-open:inline">Close ▴</span>
                  </summary>
                  <div className="border-t border-line p-3">
                    <FormationForm
                      locale={locale}
                      planId={plan.id}
                      formation={formation}
                      heroes={heroes}
                      skillLevel={plan.minSkillLevel}
                      defaultLabel={formation.label}
                    />
                    <div className="mt-3 flex justify-end">
                      <DeleteForm
                        action={deleteFormation}
                        hidden={{ locale, planId: plan.id, id: formation.id }}
                        confirmText={`Delete formation ${formation.label}?`}
                      />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 rounded-2xl border border-dashed border-line p-3">
          <p className="label">Add a formation</p>
          {freeLabel ? (
            <FormationForm
              locale={locale}
              planId={plan.id}
              formation={null}
              heroes={heroes}
              skillLevel={plan.minSkillLevel}
              defaultLabel={freeLabel}
            />
          ) : (
            <EmptyRow>All twelve preset slots are used. Delete a formation to add another.</EmptyRow>
          )}
        </div>
      </AdminSection>

      <AdminSection
        id="feedback"
        tour="plan-feedback"
        title="Player feedback (retrospective)"
        hint="A short form players fill in after the battle, behind the same password as the plan: star ratings and a few optional lines. Open it after the battle, read the results under “Feedback”."
      >
        {retro && (
          <p className={`mb-4 rounded-xl px-3 py-2 text-sm font-bold ${retro.open ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted"}`}>
            {retro.open ? "The feedback form is open: players see it on the battle plan and at /kvk/feedback." : "The feedback form is closed."}{" "}
            {retro.responseCount} response{retro.responseCount === 1 ? "" : "s"} so far, deleted automatically on {utcLabel(retro.pruneAt)} UTC.
          </p>
        )}
        <RetroSettingsForm
          retro={retro}
          planId={plan.id}
          planTitle={pick(plan.title, "en") || plan.slug}
          locale={locale}
          labels={Object.fromEntries([...RATING_QUESTIONS, ...TEXT_PROMPTS].map((q) => [q.key, en[q.labelKey]]))}
          defaults={feedbackDefaults}
        />
      </AdminSection>
    </div>
  );
}

/**
 * Editing one language other than English: only the translated texts, each
 * next to its English source. Rows whose machine translation is still running
 * are locked and the page refreshes itself until they are done.
 */
async function TranslationMode({
  plan,
  retro,
  locale,
  lang,
  langLabel,
}: {
  plan: AdminKvkPlan;
  retro: AdminRetrospective | null;
  locale: string;
  lang: string;
  langLabel: string;
}) {
  const common = { locale, planId: plan.id, lang, langLabel };
  const text = (value: Localized | undefined, code: string) => (typeof value?.[code] === "string" ? value[code] : "");
  const anyPending = plan.pendingColumns.length > 0 || Object.keys(plan.pendingRows).length > 0 || (retro?.pendingColumns.length ?? 0) > 0;
  const { paused } = await getTranslationSettings();
  const rowPending = (id: string, column: string) => (plan.pendingRows[id] ?? []).includes(column);
  const coordinators = plan.coordinators.filter((c) => text(c.note, "en").trim());
  const formations = plan.formations.filter((f) => text(f.note, "en").trim());

  return (
    <>
      <PendingRefresher active={anyPending && !paused} />
      <p className="rounded-xl bg-card-soft px-3 py-2 text-sm font-bold text-ink-muted">
        Corrections saved here apply to {langLabel} only and are never overwritten until the English text changes again.
        {anyPending && pendingNote(paused)}
      </p>

      <AdminSection title="Plan texts">
        <div className="space-y-3">
          <TranslationForm {...common} table="kvk_plans" id={plan.id} column="title" label="Title" english={text(plan.title, "en")} value={text(plan.title, lang)} pending={plan.pendingColumns.includes("title")} maxLength={TEXT_LIMITS.title} />
          <TranslationForm {...common} table="kvk_plans" id={plan.id} column="intro" label="Introduction (Markdown)" english={plan.introSource} value={introSourceFor(plan, lang)} pending={plan.pendingColumns.includes("intro")} multiline maxLength={TEXT_LIMITS.intro} />
        </div>
      </AdminSection>

      <AdminSection title="Battle-day instructions">
        {plan.rules.length === 0 ? (
          <EmptyRow>No instructions yet.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {plan.rules.map((rule) => (
              <TranslationForm key={rule.id} {...common} table="kvk_rules" id={rule.id} column="text" label="Instruction" english={text(rule.text, "en")} value={text(rule.text, lang)} pending={rowPending(rule.id, "text")} maxLength={TEXT_LIMITS.text} />
            ))}
          </div>
        )}
      </AdminSection>

      <AdminSection title="Coordinator notes" hint="Only coordinators with an English note.">
        {coordinators.length === 0 ? (
          <EmptyRow>No notes to translate.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {coordinators.map((c) => (
              <TranslationForm key={c.id} {...common} table="kvk_coordinators" id={c.id} column="note" label={`Note for ${c.name}`} english={text(c.note, "en")} value={text(c.note, lang)} pending={rowPending(c.id, "note")} maxLength={TEXT_LIMITS.note} />
            ))}
          </div>
        )}
      </AdminSection>

      {retro && (
        <AdminSection title="Feedback form texts" hint="The title and introduction players see above the feedback questions. The questions themselves are translated with the interface strings.">
          <div className="space-y-3">
            <TranslationForm {...common} table="kvk_retrospectives" id={retro.id} column="title" label="Feedback title" english={text(retro.title, "en")} value={text(retro.title, lang)} pending={retro.pendingColumns.includes("title")} maxLength={TEXT_LIMITS.title} />
            <TranslationForm {...common} table="kvk_retrospectives" id={retro.id} column="intro" label="Feedback introduction (Markdown)" english={text(retro.introSource, "en")} value={introSourceFor({ intro: retro.intro, introSources: retro.introSource }, lang)} pending={retro.pendingColumns.includes("intro")} multiline maxLength={TEXT_LIMITS.intro} />
          </div>
        </AdminSection>
      )}

      <AdminSection title="Formation notes" hint="Only formations with an English note.">
        {formations.length === 0 ? (
          <EmptyRow>No notes to translate.</EmptyRow>
        ) : (
          <div className="space-y-3">
            {formations.map((f) => (
              <TranslationForm key={f.id} {...common} table="kvk_formations" id={f.id} column="note" label={`Note for preset ${f.label}`} english={text(f.note, "en")} value={text(f.note, lang)} pending={rowPending(f.id, "note")} maxLength={TEXT_LIMITS.note} />
            ))}
          </div>
        )}
      </AdminSection>
    </>
  );
}
