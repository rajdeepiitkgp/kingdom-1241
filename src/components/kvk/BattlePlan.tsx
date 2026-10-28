import { ArrowRight, MessageSquareHeart } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/SectionTitle";
import type { Alliance, CoordinatorTeam, Hero, KvkPlan } from "@/lib/data/types";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { BattleHeader } from "./BattleHeader";
import { FormationBoard } from "./FormationBoard";
import { HeroAvatar } from "./HeroAvatar";
import { RuleIcon } from "./RuleIcon";

/**
 * The unlocked battle plan. Server Component: only the interactive bits
 * (countdown, formation checklist, lock button) are Client Components.
 * `plan` never contains the password — see KvkGate.
 */
export function BattlePlan({
  plan,
  heroes,
  alliances,
  dict,
  locale,
  feedbackHref = null,
}: {
  plan: KvkPlan;
  heroes: Hero[];
  alliances: Alliance[];
  dict: Dictionary;
  locale: string;
  /** Link to the open feedback form, when there is one. */
  feedbackHref?: string | null;
}) {
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(plan.updatedAt),
  );
  const teams: CoordinatorTeam[] = ["kvk", "tmp"];
  const tagColor = new Map(alliances.map((a) => [a.tag, a.color]));
  const exampleHero = heroes.find((h) => plan.formations.some((f) => f.heroSlugs[0] === h.slug)) ?? heroes[0] ?? null;

  return (
    <div className="space-y-10">
      <BattleHeader
        eventType={plan.eventType}
        title={plan.title}
        opponent={plan.opponent}
        battleAt={plan.battleAt}
        battleEndAt={plan.battleEndAt}
        intro={plan.intro}
        area="plan"
        dict={dict}
        locale={locale}
      />

      {/* Battle feedback (retrospective), while a form is open */}
      {feedbackHref && (
        <Link
          href={feedbackHref}
          data-tour="kvk-feedback"
          className="card group flex items-center gap-4 overflow-hidden border-2 border-gold/60 p-4 transition-shadow hover:shadow-lift md:p-5"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-on-gold shadow-[0_4px_0_0_var(--gold-strong)]" aria-hidden>
            <MessageSquareHeart className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-black text-ink">{dict["kvk.feedback.title"]}</span>
            <span className="block text-sm font-semibold text-ink-muted">{dict["kvk.feedback.body"]}</span>
          </span>
          <span className="btn-gold btn-sm hidden shrink-0 sm:inline-flex">
            {dict["kvk.feedback.open"]} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </span>
          <ArrowRight className="size-5 shrink-0 text-gold-strong sm:hidden rtl:rotate-180" aria-hidden />
        </Link>
      )}

      {/* Instructions */}
      {plan.rules.length > 0 && (
        <section data-tour="kvk-rules">
          <SectionTitle icon="📋" title={dict["kvk.instructions"]} />
          <ol className="grid grid-cols-1 gap-2">
            {plan.rules.map((rule) => (
              <li key={rule.id} className="card flex items-start gap-3 px-4 py-3">
                <RuleIcon kind={rule.kind} />
                <div className="min-w-0 flex-1">
                  <span className="text-[0.6875rem] font-black tracking-wider text-ink-faint uppercase">{dict[`kvk.rule.${rule.kind}`]}</span>
                  <p className="text-[0.98rem] font-semibold text-ink" dir="auto">
                    {pick(rule.text, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Coordinators */}
      {plan.coordinators.length > 0 && (
        <section data-tour="kvk-coordinators">
          <SectionTitle icon="📣" title={dict["kvk.coordinators"]} />
          <p className="-mt-2 mb-4 text-sm font-semibold text-ink-muted">{dict["kvk.coordinators.hint"]}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {teams.map((team) => {
              const members = plan.coordinators.filter((c) => c.team === team);
              if (members.length === 0) return null;
              return (
                <div key={team} className="card p-4">
                  <h3 className="text-sm font-black tracking-wider text-ink-muted uppercase">{dict[`kvk.coordinators.${team}`]}</h3>
                  <ul className="mt-3 grid grid-cols-1 gap-2">
                    {members.map((c) => {
                      const note = pick(c.note, locale);
                      const color = c.allianceTag ? tagColor.get(c.allianceTag) : undefined;
                      return (
                        <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-card-soft px-3 py-2">
                          <span
                            className="grid size-9 shrink-0 place-items-center rounded-xl text-[0.6875rem] font-black text-white shadow-[0_2px_0_0_rgba(0,0,0,0.18)]"
                            style={{ backgroundColor: color ?? "var(--primary)" }}
                            dir="ltr"
                            aria-hidden
                          >
                            {c.allianceTag ?? c.name.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="line-clamp-2 font-extrabold wrap-break-word text-ink" dir="auto">
                              {c.name}
                            </p>
                            {note && (
                              <p className="line-clamp-2 text-xs font-semibold wrap-break-word text-ink-muted" dir="auto">
                                {note}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Formations */}
      <section data-tour="kvk-formations">
        <SectionTitle icon="⚔️" title={dict["kvk.formations"]} />
        <div className="card mb-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-3 self-start rounded-2xl bg-card-soft p-3">
            <HeroAvatar
              hero={exampleHero}
              locale={locale}
              skillLevel={plan.minSkillLevel}
              size="lg"
              anyLabel={dict["kvk.anyHero"]}
              skillTitle={dict["kvk.skillLevel"]}
            />
            <p className="max-w-40 text-xs/snug font-bold text-ink-muted">
              {dict["kvk.skillLevel"]}: <span className="text-gold-strong">{plan.minSkillLevel}</span>
              <br />
              <span className="font-semibold text-ink-faint">{dict["kvk.skillHint"]}</span>
              <br />
              <span className="text-gold-strong">{"★".repeat(plan.minHeroStars)}</span>+
            </p>
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-ink">{dict["kvk.req.title"]}</h3>
            <ul className="mt-1 space-y-1 text-sm font-semibold text-ink-muted">
              <li>⭐ {format(dict["kvk.req.skill"], { level: plan.minSkillLevel })}</li>
              <li>✨ {format(dict["kvk.req.stars"], { stars: plan.minHeroStars })}</li>
              <li>💾 {dict["kvk.formations.hint"]}</li>
            </ul>
          </div>
        </div>
        <FormationBoard
          planId={plan.id}
          formations={plan.formations}
          heroes={heroes}
          minSkillLevel={plan.minSkillLevel}
          dict={dict}
          locale={locale}
        />
      </section>

      <p className="text-center text-xs font-semibold text-ink-faint">
        {dict["kvk.updated"]}: <time dateTime={plan.updatedAt}>{updated}</time>
      </p>
    </div>
  );
}
