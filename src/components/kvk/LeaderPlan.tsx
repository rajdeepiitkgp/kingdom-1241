import clsx from "clsx";
import { Clock, Info, MapPin, PawPrint } from "lucide-react";
import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import type { Alliance, CoordinatorTeam, Hero, KvkLeaderPlan, TroopType } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { roleLabelKey } from "@/lib/kvk/formations";
import { type NumberedRally, ralliesByTeam, rulesByAudience } from "@/lib/kvk/leaders";
import { BattleHeader } from "./BattleHeader";
import { HeroAvatar } from "./HeroAvatar";
import { PetsTime, RallyStart } from "./RallyTime";
import { RuleIcon } from "./RuleIcon";
import { TroopRatioBar } from "./TroopRatioBar";

const SIDE_CHIP: Record<string, string> = {
  attack: "bg-danger-soft text-danger",
  defense: "bg-success-soft text-success",
  any: "bg-primary-soft text-primary",
};
const SIDE_ICON: Record<string, string> = { attack: "⚔️", defense: "🛡️", any: "👑" };
const TEAM_CHIP: Record<CoordinatorTeam, string> = {
  kvk: "bg-primary text-primary-ink",
  tmp: "bg-gold text-on-gold",
};
const TEAM_TAG: Record<CoordinatorTeam, string> = { kvk: "[KvK]", tmp: "[TMP]" };

/**
 * The unlocked rally-leader plan: a short overview, the leaders' instructions
 * (every leader / rally leads / garrison leads), an at-a-glance roster by
 * battle team, and one card per rally (team, role, position, start time,
 * pets, the leader's own heroes and troop ratio). Server Component; only the
 * times are client parts. `plan` never contains the password — see LeaderGate.
 */
export function LeaderPlan({
  plan,
  heroes,
  alliances,
  dict,
  locale,
}: {
  plan: KvkLeaderPlan;
  heroes: Hero[];
  alliances: Alliance[];
  dict: Dictionary;
  locale: string;
}) {
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(plan.updatedAt),
  );
  const teams = ralliesByTeam(plan.rallies);
  const ruleGroups = rulesByAudience(plan.rules);
  const card = { plan, heroBySlug: new Map(heroes.map((h) => [h.slug, h])), tagColor: new Map(alliances.map((a) => [a.tag, a.color])), dict, locale };

  return (
    <div className="space-y-10">
      <BattleHeader
        eventType={plan.eventType}
        title={plan.title}
        opponent={plan.opponent}
        battleAt={plan.battleAt}
        battleEndAt={plan.battleEndAt}
        intro={plan.intro}
        area="leaders"
        dict={dict}
        locale={locale}
      />

      <p className="-mt-4 flex items-start gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-sm font-semibold text-ink">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0">{dict["leaders.overview"]}</span>
      </p>

      {/* Instructions, by audience */}
      {ruleGroups.length > 0 && (
        <section>
          <SectionTitle icon="📋" title={dict["leaders.instructions"]} />
          <div className="grid grid-cols-1 gap-4">
            {ruleGroups.map((group) => (
              <div key={group.audience}>
                <h3 className="mb-2 text-sm font-black tracking-wider text-ink-muted uppercase">{dict[`leaders.audience.${group.audience}`]}</h3>
                <ol className="grid grid-cols-1 gap-2">
                  {group.rules.map((rule) => (
                    <li key={rule.id} className="card flex items-start gap-3 px-4 py-3">
                      <RuleIcon kind={rule.kind} />
                      <div className="min-w-0 flex-1">
                        <span className="text-[0.6875rem] font-black tracking-wider text-ink-faint uppercase">{dict[`kvk.rule.${rule.kind}`]}</span>
                        <p className="text-[0.98rem] font-semibold wrap-break-word text-ink" dir="auto">
                          {pick(rule.text, locale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      {plan.rallies.length === 0 ? (
        <section>
          <SectionTitle icon="👑" title={dict["leaders.rallies"]} />
          <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["leaders.empty"]}</p>
        </section>
      ) : (
        <>
          {/* At a glance: who leads what, by battle team; each row jumps to the card */}
          <section>
            <SectionTitle icon="🗺️" title={dict["leaders.glance"]} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {teams.map((group) => (
                <div key={group.team} className="card min-w-0 p-4">
                  <h3 className="text-sm font-black tracking-wider text-ink-muted uppercase">{dict[`kvk.coordinators.${group.team}`]}</h3>
                  <ul className="mt-3 grid grid-cols-1 gap-1.5">
                    {group.rallies.map(({ rally, number }) => (
                      <li key={rally.id}>
                        <a href={`#rally-${number}`} className="flex items-center gap-3 rounded-xl bg-card-soft px-3 py-2 transition-colors hover:bg-primary-soft">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-gold text-sm font-black text-on-gold" dir="ltr">
                            {number}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-extrabold wrap-break-word text-ink">
                              <bdi>{rally.name}</bdi>
                            </span>
                            <span className="block text-xs font-semibold wrap-break-word text-ink-muted" dir="auto">
                              {pick(rally.target, locale)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-bold text-ink-faint">
                            <RallyStart startAt={rally.startAt} dict={dict} locale={locale} compact />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* One card per rally, by battle team */}
          {teams.map((group) => (
            <section key={group.team}>
              <SectionTitle icon={group.team === "kvk" ? "⚔️" : "🔁"} title={dict[`kvk.coordinators.${group.team}`]} />
              {group.team === teams[0].team && <p className="-mt-2 mb-4 text-sm font-semibold text-ink-muted">{dict["leaders.ralliesHint"]}</p>}
              <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {group.rallies.map((entry) => (
                  <RallyCard key={entry.rally.id} entry={entry} {...card} />
                ))}
              </ol>
            </section>
          ))}
        </>
      )}

      <p className="text-center text-xs font-semibold text-ink-faint">
        {dict["kvk.updated"]}: <time dateTime={plan.updatedAt}>{updated}</time>
      </p>
    </div>
  );
}

function RallyCard({
  entry: { rally, number },
  plan,
  heroBySlug,
  tagColor,
  dict,
  locale,
}: {
  entry: NumberedRally;
  plan: KvkLeaderPlan;
  heroBySlug: Map<string, Hero>;
  tagColor: Map<string, string>;
  dict: Dictionary;
  locale: string;
}) {
  const role = dict[`kvk.role.${roleLabelKey(rally.side, "rally_lead") ?? "lead"}`];
  const target = pick(rally.target, locale);
  const position = pick(rally.position, locale);
  const note = pick(rally.note, locale);
  const color = rally.allianceTag ? tagColor.get(rally.allianceTag) : undefined;
  const troopLabels: Record<TroopType, string> = {
    infantry: dict["tools.refill.infantry"],
    cavalry: dict["tools.refill.cavalry"],
    archers: dict["tools.refill.archers"],
  };

  return (
    <li id={`rally-${number}`} className="card flex min-w-0 scroll-mt-24 flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold text-lg font-black text-on-gold shadow-[0_3px_0_0_var(--gold-strong)]" dir="ltr">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap gap-1.5">
            <span className={clsx("chip", TEAM_CHIP[rally.team])} dir="ltr">
              {TEAM_TAG[rally.team]}
            </span>
            <span className={clsx("chip", SIDE_CHIP[rally.side])}>
              <span aria-hidden>{SIDE_ICON[rally.side]}</span>
              {role}
            </span>
          </p>
          <h3 className="mt-1 text-lg/tight font-black wrap-break-word text-ink" dir="auto">
            {target || role}
          </h3>
        </div>
      </div>

      {/* The leader: battle team above, home alliance as the badge */}
      <div className="flex items-center gap-3 rounded-2xl bg-card-soft px-3 py-2">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl text-[0.6875rem] font-black text-white shadow-[0_2px_0_0_rgba(0,0,0,0.18)]"
          style={{ backgroundColor: color ?? "var(--primary)" }}
          dir="ltr"
          title={rally.allianceTag ? `${dict["leaders.homeAlliance"]}: ${rally.allianceTag}` : undefined}
          aria-hidden
        >
          {rally.allianceTag ?? rally.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="font-extrabold wrap-break-word text-ink">
            <bdi>{rally.name}</bdi>
          </p>
          {rally.allianceTag && (
            <p className="text-xs font-semibold text-ink-muted">
              {dict["leaders.homeAlliance"]}: <span dir="ltr">[{rally.allianceTag}]</span>
            </p>
          )}
        </div>
      </div>

      {/* Where and when */}
      <dl className="grid grid-cols-1 gap-2 text-sm">
        {position && (
          <Fact icon={<MapPin className="size-4" />} label={dict["leaders.position"]}>
            <span dir="auto">{position}</span>
          </Fact>
        )}
        <Fact icon={<Clock className="size-4" />} label={dict["leaders.start"]}>
          <RallyStart startAt={rally.startAt} dict={dict} locale={locale} />
        </Fact>
        {rally.petsOffsetMinutes !== null && (
          <Fact icon={<PawPrint className="size-4" />} label={dict["leaders.pets"]}>
            <PetsTime offsetMinutes={rally.petsOffsetMinutes} battleAt={plan.battleAt} dict={dict} locale={locale} />
          </Fact>
        )}
      </dl>

      <div className="flex flex-wrap gap-2">
        {rally.heroSlugs.map((slug, i) => (
          <HeroAvatar
            key={i}
            hero={slug ? (heroBySlug.get(slug) ?? null) : null}
            locale={locale}
            skillLevel={plan.minSkillLevel}
            anyLabel={dict["kvk.anyHero"]}
            skillTitle={dict["kvk.skillLevel"]}
          />
        ))}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-black tracking-wider text-ink-faint uppercase">{dict["kvk.troopRatio"]}</p>
        <TroopRatioBar ratio={{ infantry: rally.infantry, cavalry: rally.cavalry, archers: rally.archers }} labels={troopLabels} />
      </div>

      {note && (
        <p className="rounded-xl bg-card-soft px-3 py-2 text-sm font-semibold wrap-break-word text-ink-muted" dir="auto">
          {note}
        </p>
      )}
    </li>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-card-soft px-3 py-2">
      <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[0.6875rem] font-black tracking-wider text-ink-faint uppercase">{label}</dt>
        <dd className="font-bold wrap-break-word text-ink">{children}</dd>
      </div>
    </div>
  );
}
