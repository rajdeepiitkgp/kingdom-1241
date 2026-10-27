import { Castle, Swords } from "lucide-react";
import { prepareRichText, RichText } from "@/components/content/RichText";
import type { KvkEventType } from "@/lib/data/types";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { pick, type Localized } from "@/lib/i18n/localized";
import type { KvkArea } from "@/lib/kvk/access";
import { hasBattleTokens } from "@/lib/kvk/battle-tokens";
import { BattleCountdown } from "./BattleCountdown";
import { LiveIntro } from "./LiveIntro";
import { LockButton } from "./LockButton";

/**
 * The card at the top of an unlocked battle page (battle plan, rally-leader
 * plan, commander checklist): event, title, opponent, countdown, the page's
 * own lock button and its introduction. Server Component; the countdown and a
 * token intro are the client parts.
 */
export function BattleHeader({
  eventType,
  title,
  opponent,
  battleAt,
  battleEndAt,
  intro,
  area,
  dict,
  locale,
}: {
  eventType: KvkEventType;
  title: Localized;
  opponent: string | null;
  battleAt: string | null;
  battleEndAt: string | null;
  /** Sanitised HTML per language. */
  intro: Localized;
  /** Which page's cookie the lock button clears. */
  area: KvkArea;
  dict: Dictionary;
  locale: string;
}) {
  const html = pick(intro, locale);
  return (
    <section className="card relative overflow-hidden p-5 md:p-7">
      <div className="pointer-events-none absolute -inset-e-12 -top-12 size-44 rounded-full bg-gold/25 blur-2xl" aria-hidden />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={eventType === "kvk" ? "chip bg-danger-soft text-danger" : "chip bg-gold-soft text-gold-strong"}>
            {eventType === "kvk" ? <Swords className="size-3.5" aria-hidden /> : <Castle className="size-3.5" aria-hidden />}
            {dict[`kvk.event.${eventType}`]}
          </p>
          <h2 className="mt-2 text-2xl/tight font-black text-ink md:text-3xl" dir="auto">
            {pick(title, locale)}
          </h2>
          {opponent && (
            <p className="mt-1 text-sm font-bold text-ink-muted">
              {dict["kvk.opponent"]}: <span className="text-ink">{opponent}</span>
            </p>
          )}
        </div>
        <LockButton label={dict["kvk.lock"]} area={area} />
      </div>
      <p className="relative mt-2 text-xs font-semibold text-ink-faint">{dict["kvk.cycle"]}</p>
      {battleAt && <BattleCountdown battleAt={battleAt} battleEndAt={battleEndAt} dict={dict} locale={locale} />}
      {/* {{when}} / {{date}} / {{time}} / {{utc}} in the intro are filled in per visitor (see battle-tokens.ts). */}
      {html &&
        (hasBattleTokens(html) ? (
          <LiveIntro html={prepareRichText(html)} battleAt={battleAt} locale={locale} className="mt-5" />
        ) : (
          <RichText html={html} className="mt-5" />
        ))}
    </section>
  );
}
