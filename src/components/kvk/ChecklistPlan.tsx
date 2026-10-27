import { SectionTitle } from "@/components/ui/SectionTitle";
import type { KvkChecklistPlan, KvkChecklistRule } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { itemsByPhase, rulesInSection } from "@/lib/kvk/checklist";
import { BattleHeader } from "./BattleHeader";
import { ChecklistBoard, type ChecklistGroup } from "./ChecklistBoard";
import { RuleIcon } from "./RuleIcon";

/**
 * The unlocked commander checklist: the commander's brief, the checklist by
 * phase (ticked off on the visitor's device), the commander's orders and the
 * general guidelines. Server Component; the ticks and the times are the client
 * parts, and only the visitor's language reaches the board. `plan` never
 * contains the password — see ChecklistGate.
 */
export function ChecklistPlan({ plan, dict, locale }: { plan: KvkChecklistPlan; dict: Dictionary; locale: string }) {
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(plan.updatedAt),
  );
  const groups: ChecklistGroup[] = itemsByPhase(plan.items).map((group) => ({
    phase: group.phase,
    items: group.items.map((item) => ({ id: item.id, text: pick(item.text, locale), note: pick(item.note, locale) })),
  }));
  const commander = rulesInSection(plan.rules, "commander");
  const general = rulesInSection(plan.rules, "general");

  return (
    <div className="space-y-10">
      <BattleHeader
        eventType={plan.eventType}
        title={plan.title}
        opponent={plan.opponent}
        battleAt={plan.battleAt}
        battleEndAt={plan.battleEndAt}
        intro={plan.intro}
        area="checklist"
        dict={dict}
        locale={locale}
      />

      <section>
        <SectionTitle icon="✅" title={dict["checklist.items"]} />
        {groups.length === 0 ? (
          <p className="card px-5 py-6 text-center font-semibold text-ink-muted">{dict["checklist.empty"]}</p>
        ) : (
          <>
            <p className="-mt-2 mb-4 text-sm font-semibold text-ink-muted">{dict["checklist.itemsHint"]}</p>
            <ChecklistBoard planId={plan.planId} groups={groups} dict={dict} />
          </>
        )}
      </section>

      {commander.length > 0 && (
        <section>
          <SectionTitle icon="🎖️" title={dict["checklist.commander"]} />
          <p className="-mt-2 mb-4 text-sm font-semibold text-ink-muted">{dict["checklist.commanderHint"]}</p>
          <RuleLines rules={commander} dict={dict} locale={locale} />
        </section>
      )}

      {general.length > 0 && (
        <section>
          <SectionTitle icon="📌" title={dict["checklist.guidelines"]} />
          <RuleLines rules={general} dict={dict} locale={locale} />
        </section>
      )}

      <p className="text-center text-xs font-semibold text-ink-faint">
        {dict["kvk.updated"]}: <time dateTime={plan.updatedAt}>{updated}</time>
      </p>
    </div>
  );
}

function RuleLines({ rules, dict, locale }: { rules: KvkChecklistRule[]; dict: Dictionary; locale: string }) {
  return (
    <ol className="grid grid-cols-1 gap-2">
      {rules.map((rule) => (
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
  );
}
