// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { connection } from "next/server";
import { getAlliances, getSettings } from "@/lib/data";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { dayStart } from "@/lib/kvk/prep";
import { rosterOf } from "@/lib/ministry/assign";
import { rosterDays, rosterFor } from "@/lib/ministry/roster";
import { ministryUnlocked, openDays, openMinistryRound } from "@/lib/ministry/state";
import { ministryStore } from "@/lib/ministry/store";
import { mightPulseConfigured } from "@/lib/retro/mightpulse";
import { ItemIcon } from "../kvk/ItemIcon";
import { LockButton } from "../kvk/LockButton";
import { UnlockCard } from "../kvk/UnlockCard";
import { BUFF_ICON, BUFF_IMAGES } from "./icons";
import type { RosterDay } from "./MinistryRoster";
import { MinistrySignup, type RoundView } from "./MinistrySignup";

/**
 * Reads the battle-plan cookie (request time, so it renders inside
 * <Suspense>) and shows the password form, the round's sign-ups, or that none
 * are open. The plan's password never reaches a component.
 */
export async function MinistryGate({ dict, locale }: { dict: Dictionary; locale: string }) {
  const access = await ministryUnlocked();
  if (!access.plan) return <Note text={dict["ministry.none"]} />;
  if (!access.unlocked) return <UnlockCard dict={dict} />;

  // Which round is open and which days still take sign-ups depends on the clock.
  await connection();
  const now = new Date();
  const round = await openMinistryRound(now);
  if (!round) {
    return (
      <div className="space-y-4">
        <Note text={dict["ministry.none"]} />
        <p className="text-center">
          <LockButton label={dict["kvk.lock"]} />
        </p>
      </div>
    );
  }
  const [alliances, settings] = await Promise.all([getAlliances(), getSettings()]);
  // Server-rendered dates are formatted in UTC (hydration safety): the buff days are UTC days.
  const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  // The scoring days of the round: Monday (Day 1) to Friday (Day 5).
  const view: RoundView = {
    key: round.key,
    sections: round.sections.map((section) => ({
      day: section.day,
      buffs: section.buffs,
      start: dayStart(round.round, section.day).getTime(),
      date: date.format(dayStart(round.round, section.day)),
      deadline: (round.deadlines[section.day] as Date).getTime(),
    })),
  };

  // The rosters of the days past their deadline (this read runs a due assignment). Names only: no Governor ID goes to the browser.
  const rosters: RosterDay[] = [];
  const store = ministryStore();
  if (store) {
    const roster = await rosterFor(store, round, now);
    const days = rosterDays(round, roster, now);
    if (days.length > 0) {
      try {
        const names = new Map((await store.list(round.key)).filter((signup) => !signup.disabled).map((signup) => [signup.id, `${signup.allianceTag ? `[${signup.allianceTag}] ` : ""}${signup.gameName}`]));
        for (const section of view.sections.filter((entry) => days.includes(entry.day))) {
          const cells = rosterOf(roster.appointments, section.day).map((held) => (held ? (names.get(held.signupId) ?? null) : null));
          rosters.push({ day: section.day, buffs: section.buffs, date: section.date, start: section.start, cells });
        }
      } catch {
        // The roster stays away on a failed read; the sign-ups below still work.
      }
    }
  }

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden p-5 md:p-7" data-tour="ministry-round">
        <div className="pointer-events-none absolute -inset-e-12 -top-12 size-44 rounded-full bg-gold/25 blur-2xl" aria-hidden />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="min-w-0 text-2xl/tight font-black wrap-break-word text-ink">
              {format(dict["ministry.round"], { from: date.format(dayStart(round.round, 1)), to: date.format(dayStart(round.round, 5)) })}
            </h2>
            <LockButton label={dict["kvk.lock"]} />
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {view.sections.map((section) => (
              <li key={section.day} className="flex min-w-0 items-center gap-3 rounded-2xl bg-card-soft p-3">
                <span className="flex shrink-0 items-center gap-1">
                  {section.buffs.map((buff) => (
                    <ItemIcon key={buff} image={BUFF_IMAGES[buff]} emoji={BUFF_ICON[buff]} className="size-9" />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm/tight font-extrabold wrap-break-word text-ink">{section.buffs.map((buff) => dict[`prep.council.${buff}`]).join(" + ")}</span>
                  <span className="block text-xs font-bold text-ink-muted">
                    {format(dict["prep.day"], { n: section.day })} · {section.date}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-sm font-semibold text-ink-muted">{dict["ministry.how"]}</p>
        </div>
      </section>

      <MinistrySignup
        round={view}
        openDays={openDays(round, now)}
        rosters={rosters}
        alliances={alliances.filter((a) => a.published).map((a) => ({ tag: a.tag, name: a.name }))}
        kingdom={settings.kingdomNumber}
        lookupEnabled={mightPulseConfigured()}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <p className="card mx-auto max-w-md px-5 py-8 text-center font-semibold text-ink-muted" data-tour="ministry-none">
      <span className="mb-2 block text-4xl" aria-hidden>
        👑
      </span>
      {text}
    </p>
  );
}

export function MinistryGateSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="card h-44 bg-card-soft" />
      <div className="card h-72 bg-card-soft" />
    </div>
  );
}
