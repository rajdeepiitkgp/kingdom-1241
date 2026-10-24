import { Ban, Castle, CircleCheck, Info, Swords } from "lucide-react";
import { prepareRichText, RichText } from "@/components/content/RichText";
import { SectionTitle } from "@/components/ui/SectionTitle";
import type { Alliance, CoordinatorTeam, Hero, KvkPlan, KvkRuleKind } from "@/lib/data/types";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { hasBattleTokens } from "@/lib/kvk/battle-tokens";
import { BattleCountdown } from "./BattleCountdown";
import { FormationBoard } from "./FormationBoard";
import { HeroAvatar } from "./HeroAvatar";
import { LiveIntro } from "./LiveIntro";
import { LockButton } from "./LockButton";

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
}: {
  plan: KvkPlan;
  heroes: Hero[];
  alliances: Alliance[];
  dict: Dictionary;
  locale: string;
}) {
  const intro = pick(plan.intro, locale);
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(plan.updatedAt),
  );
  const teams: CoordinatorTeam[] = ["kvk", "tmp"];
  const tagColor = new Map(alliances.map((a) => [a.tag, a.color]));
  const exampleHero = heroes.find((h) => plan.formations.some((f) => f.heroSlugs[0] === h.slug)) ?? heroes[0] ?? null;

  return (
    <div className="space-y-10">
      {/* Plan header */}
      <section className="card relative overflow-hidden p-5 md:p-7">
        <div className="pointer-events-none absolute -inset-e-12 -top-12 size-44 rounded-full bg-gold/25 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={plan.eventType === "kvk" ? "chip bg-danger-soft text-danger" : "chip bg-gold-soft text-gold-strong"}>
              {plan.eventType === "kvk" ? <Swords className="size-3.5" aria-hidden /> : <Castle className="size-3.5" aria-hidden />}
              {dict[`kvk.event.${plan.eventType}`]}
            </p>
            <h2 className="mt-2 text-2xl/tight font-black text-ink md:text-3xl" dir="auto">
              {pick(plan.title, locale)}
            </h2>
            {plan.opponent && (
              <p className="mt-1 text-sm font-bold text-ink-muted">
                {dict["kvk.opponent"]}: <span className="text-ink">{plan.opponent}</span>
              </p>
            )}
          </div>
          <LockButton label={dict["kvk.lock"]} />
        </div>
        <p className="relative mt-2 text-xs font-semibold text-ink-faint">{dict["kvk.cycle"]}</p>
        {plan.battleAt && <BattleCountdown battleAt={plan.battleAt} dict={dict} locale={locale} />}
        {/* {{when}} / {{date}} / {{time}} / {{utc}} in the intro are filled in per visitor (see battle-tokens.ts). */}
        {intro &&
          (hasBattleTokens(intro) ? (
            <LiveIntro html={prepareRichText(intro)} battleAt={plan.battleAt} locale={locale} className="mt-5" />
          ) : (
            <RichText html={intro} className="mt-5" />
          ))}
      </section>

      {/* Instructions */}
      {plan.rules.length > 0 && (
        <section>
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
        <section>
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
                            <p className="truncate font-extrabold text-ink" dir="auto">
                              {c.name}
                            </p>
                            {note && (
                              <p className="truncate text-xs font-semibold text-ink-muted" dir="auto">
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
      <section>
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

function RuleIcon({ kind }: { kind: KvkRuleKind }) {
  const common = "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl";
  switch (kind) {
    case "do":
      return (
        <span className={`${common} bg-success-soft text-success`} aria-hidden>
          <CircleCheck className="size-5" />
        </span>
      );
    case "dont":
      return (
        <span className={`${common} bg-danger-soft text-danger`} aria-hidden>
          <Ban className="size-5" />
        </span>
      );
    default:
      return (
        <span className={`${common} bg-primary-soft text-primary`} aria-hidden>
          <Info className="size-5" />
        </span>
      );
  }
}
