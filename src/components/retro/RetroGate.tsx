import { ArrowLeft, Castle, Swords } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { RichText } from "@/components/content/RichText";
import { getAlliances, getSettings } from "@/lib/data";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";
import { localePath } from "@/lib/i18n/paths";
import { retroAccess } from "@/lib/retro/gate";
import { mightPulseConfigured } from "@/lib/retro/mightpulse";
import { isOpenNow } from "@/lib/retro/retention";
import { KvkTabs } from "../kvk/KvkTabs";
import { UnlockCard } from "../kvk/UnlockCard";
import { RetroForm } from "./RetroForm";

/**
 * Reads the battle-plan cookie (request time → rendered inside <Suspense>) and
 * shows the password form, the feedback form, or why there is none. The plan
 * password never reaches a component.
 */
export async function RetroGate({ dict, locale }: { dict: Dictionary; locale: string }) {
  const access = await retroAccess();
  if (!access) return <Note icon="📝" text={dict["retro.none"]} />;
  const { retro, unlocked } = access;
  if (!unlocked) return <UnlockCard dict={dict} />;

  // Whether the form is still open depends on the clock: opt in to request time before reading it.
  await connection();
  const open = isOpenNow(retro, new Date());
  const [alliances, settings] = await Promise.all([getAlliances(), getSettings()]);
  const title = pick(retro.title, locale) || pick(retro.battle.title, locale);
  const intro = pick(retro.intro, locale);
  // Server-rendered dates are formatted in UTC (hydration safety); the day of a battle is the same in every zone that matters here.
  const battleDate = retro.battle.battleAt
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(retro.battle.battleAt))
    : null;
  const kvk = retro.battle.eventType === "kvk";

  return (
    <div className="space-y-6">
      <KvkTabs locale={locale} dict={dict} current="feedback" />
      <section className="card relative overflow-hidden p-5 md:p-7" data-tour="retro-header">
        <div className="pointer-events-none absolute -inset-e-12 -top-12 size-44 rounded-full bg-gold/25 blur-2xl" aria-hidden />
        <div className="relative">
          <p className="flex flex-wrap items-center gap-2">
            <span className={kvk ? "chip bg-danger-soft text-danger" : "chip bg-gold-soft text-gold-strong"}>
              {kvk ? <Swords className="size-3.5" aria-hidden /> : <Castle className="size-3.5" aria-hidden />}
              {dict[`kvk.event.${retro.battle.eventType}`]}
            </span>
            {battleDate && <span className="chip bg-card-soft text-ink-muted">{format(dict["retro.battleOn"], { date: battleDate })}</span>}
          </p>
          <h2 className="mt-2 text-2xl/tight font-black text-ink md:text-3xl" dir="auto">
            {title}
          </h2>
          {intro && <RichText html={intro} className="mt-4" />}
        </div>
      </section>

      {open ? (
        <RetroForm
          retroId={retro.id}
          config={retro.config}
          alliances={alliances.filter((a) => a.published).map((a) => ({ tag: a.tag, name: a.name }))}
          kingdom={settings.kingdomNumber}
          lookupEnabled={mightPulseConfigured()}
          dict={dict}
          locale={locale}
        />
      ) : (
        <Note icon="🔒" text={dict["retro.closed"]} tour="retro-closed" />
      )}

      <p className="text-center">
        <Link href={localePath(locale, "/kvk")} className="btn-ghost btn-sm">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {dict["retro.backToPlan"]}
        </Link>
      </p>
    </div>
  );
}

function Note({ icon, text, tour }: { icon: string; text: string; tour?: string }) {
  return (
    <p className="card mx-auto max-w-md px-5 py-8 text-center font-semibold text-ink-muted" data-tour={tour}>
      <span className="mb-2 block text-4xl" aria-hidden>
        {icon}
      </span>
      {text}
    </p>
  );
}

export function RetroGateSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="card h-40 bg-card-soft" />
      <div className="card h-72 bg-card-soft" />
    </div>
  );
}
