"use client";

import clsx from "clsx";
import { ArrowRight, Swords } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import {
  dayCountdown,
  dayEnd,
  dayPlan,
  dayStart,
  defaultDay,
  INTEL_STACK_STEPS,
  intelStackFor,
  markOn,
  PREP_DAYS,
  PREP_ITEMS,
  PREP_TIPS,
  type PrepDay,
  type PrepItem,
  type PrepPhase,
  type PrepRound,
  pointsOn,
  prepPhase,
  roundFor,
  SAVE_FOR_KVK,
  SCORING_DAYS,
  type ScoringDay,
} from "@/lib/kvk/prep";
import { DAY, formatLocalDateTime, formatUtcDate, formatUtcTime, HOUR, pad2, splitDuration } from "@/lib/time";
import { DurationUnits } from "../time/DurationLabel";
import { useNow } from "../time/useNow";
import { ItemIcon } from "./ItemIcon";
import {
  CALENDAR_IMAGE,
  DAY_ICON,
  DAY_IMAGES,
  dayLabel,
  ITEM_IMAGES,
  MARK_ICON,
  MASTER_PAN_IMAGE,
  phaseView,
  pointsText,
  SATURDAY,
  SAVE_IMAGES,
  TIP_IMAGES,
  themeAlt,
  tipText,
} from "./prep-labels";

/**
 * The public KvK prep page: where the round stands (live countdown), the day
 * picker with what to use, wait for or skip on that day plus the council's
 * tips, the item × day table and the "save these for KvK" reminder. Everything
 * comes from `src/lib/kvk/prep.ts`; the clock only picks today and the dates,
 * so the server renders the same page for everyone (UTC, no dates).
 */
export function PrepBoard({ dict, locale }: { dict: Dictionary; locale: string }) {
  // A minute is precise enough to move "today"; the status card ticks every second on its own.
  const now = useNow(60_000);
  const round = now ? roundFor(now) : null;
  const phase = now && round ? prepPhase(now, round) : null;
  const today = phase?.kind === "day" ? phase.day : null;
  const [picked, setPicked] = useState<PrepDay | null>(null);
  const shown = picked ?? (phase ? defaultDay(phase) : 0);

  return (
    <div className="space-y-10">
      <PrepStatus dict={dict} locale={locale} />

      <section aria-label={dict["prep.title"]}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PREP_DAYS.map((day) => {
            const active = day === shown;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => setPicked(day)}
                className={clsx(
                  "relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 px-1.5 pt-2.5 pb-2 text-center transition-colors",
                  active ? "border-primary bg-primary-soft shadow-[0_3px_0_0_var(--primary-strong)]" : "border-line bg-card hover:bg-card-soft",
                )}
              >
                {day === today && (
                  <span className="chip absolute inset-e-1.5 -top-2 bg-success px-2 py-0.5 text-[0.625rem] text-card">{dict["prep.today"]}</span>
                )}
                <span className="grid size-9 place-items-center text-2xl" aria-hidden>
                  <ItemIcon image={DAY_IMAGES[day]} emoji={DAY_ICON[day]} className="size-9" />
                </span>
                <span className={clsx("text-sm font-black wrap-break-word", active ? "text-primary" : "text-ink")}>{dayLabel(day, dict)}</span>
                <span className="line-clamp-2 text-[0.6875rem]/tight font-bold wrap-break-word hyphens-auto text-ink-muted">{dict[`prep.theme.${day}`]}</span>
                <DayTimer day={day} dict={dict} />
              </button>
            );
          })}
        </div>
        {/* Hidden until the clock has picked today, so visitors don't see Day 0 flash first. */}
        <div className={clsx("mt-4 transition-opacity duration-300", !now && picked === null && "opacity-0")}>
          <DayPanel day={shown} round={round} isToday={shown === today} dict={dict} locale={locale} />
        </div>
      </section>

      <section>
        <SectionTitle icon="📋" title={dict["prep.tableTitle"]} />
        <PrepTable today={today} dict={dict} />
      </section>

      <section>
        <SectionTitle icon="🎒" title={dict["prep.saveTitle"]} />
        <p className="-mt-2 mb-4 text-sm font-semibold text-ink-muted">{dict["prep.saveHint"]}</p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SAVE_FOR_KVK.map((item) => (
            <li key={item.id} className="card flex min-w-0 flex-col items-center gap-2 px-2 py-3 text-center">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-2xl" aria-hidden>
                <ItemIcon image={SAVE_IMAGES[item.id]} emoji={item.icon} className="size-10" />
              </span>
              <span className="min-w-0 text-sm/snug font-extrabold wrap-break-word hyphens-auto text-ink">{dict[`prep.save.${item.id}`]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** The big live card at the top: today's day and when it ends, or the countdown to the next round. */
function PrepStatus({ dict, locale }: { dict: Dictionary; locale: string }) {
  const now = useNow(1000);
  const round = now ? roundFor(now) : null;
  const phase = now && round ? prepPhase(now, round) : null;
  const view = phase ? phaseView(phase, dict) : null;

  return (
    <div className="card relative overflow-hidden border-2 border-gold/60 p-5 md:p-6">
      <div className="pointer-events-none absolute -inset-e-10 -top-10 size-36 rounded-full bg-gold/20 blur-2xl" aria-hidden />
      <div className="relative flex flex-wrap items-start gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gold text-4xl shadow-[0_4px_0_0_var(--gold-strong)]" aria-hidden>
          <ItemIcon image={view?.image ?? CALENDAR_IMAGE} emoji={view?.icon ?? "📅"} className="size-14" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{view?.eyebrow ?? dict["prep.title"]}</p>
          <p className="mt-0.5 text-2xl/tight font-black wrap-break-word text-ink">{view?.title ?? dict["prep.status.next"]}</p>
          {phase?.kind === "day" && themeAlt(phase.day, dict) && (
            <p className="text-sm font-bold wrap-break-word text-ink-muted">({themeAlt(phase.day, dict)})</p>
          )}
          {round && phase?.kind === "before" && (
            <>
              {/* Prep proper: Day 1 (Monday 00:00 UTC) until Day 5 ends at the invasion (Saturday 10:00 UTC). */}
              <p className="mt-1 text-sm font-bold text-ink-muted">{utcSpan(dayStart(round, 1), round.invasionAt, locale)}</p>
              <p className="text-xs font-semibold text-ink-muted">
                {format(dict["prep.yourTime"], { time: `${formatLocalDateTime(dayStart(round, 1), locale)} – ${formatLocalDateTime(round.invasionAt, locale)}` })}
              </p>
              <p className="text-xs font-semibold text-ink-muted">{format(dict["prep.status.getReadyOn"], { date: formatUtcDate(round.start, locale) })}</p>
            </>
          )}
        </div>
      </div>

      <div className="relative mt-4 rounded-2xl bg-card-soft px-4 py-3" aria-live="off">
        <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{view?.countdown ?? dict["prep.status.prepStartsIn"]}</p>
        <div className="mt-1 min-h-8 text-ink" suppressHydrationWarning>
          {now && phase ? <DurationUnits ms={phase.until.getTime() - now.getTime()} dict={dict} /> : <span className="text-2xl font-black text-ink-faint">--</span>}
        </div>
        {phase && (
          <p className="mt-1 text-xs font-semibold text-ink-muted" suppressHydrationWarning>
            {formatLocalDateTime(phase.until, locale)}{" "}
            <span className="whitespace-nowrap text-ink-faint" dir="ltr">
              ({formatUtcTime(phase.until)})
            </span>
          </p>
        )}
      </div>

      {phase && <PhaseFooter phase={phase} dict={dict} locale={locale} />}
    </div>
  );
}

function PhaseFooter({ phase, dict, locale }: { phase: PrepPhase; dict: Dictionary; locale: string }) {
  if (phase.kind === "before") return null;
  if (phase.kind === "day") {
    const next =
      phase.day === 5
        ? format(dict["prep.status.afterDay5"], { time: SATURDAY.invasion })
        : format(dict["prep.status.nextUp"], { what: `${dayLabel((phase.day + 1) as PrepDay, dict)} · ${dict[`prep.theme.${(phase.day + 1) as PrepDay}`]}` });
    return <p className="relative mt-3 text-sm font-extrabold wrap-break-word text-ink">{next}</p>;
  }
  // Saturday: the shield and home-coordinates reminders, and the way to the battle plan.
  return (
    <div className="relative mt-4 space-y-3">
      <TipList tips={[{ id: "shield" }, { id: "homeCoords" }]} dict={dict} />
      {phase.kind !== "afterBattle" && (
        <Link href={localePath(locale, "/kvk")} className="btn-gold btn-sm">
          <Swords className="size-4" aria-hidden /> {dict["home.kvkCard.open"]} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function DayPanel({ day, round, isToday, dict, locale }: { day: PrepDay; round: PrepRound | null; isToday: boolean; dict: Dictionary; locale: string }) {
  const plan = dayPlan(day);
  const tips = PREP_TIPS[day];
  const stackFor = intelStackFor(day);
  const scoringDay = day === 0 ? undefined : day;

  return (
    <article className={clsx("card border-2 p-4 md:p-6", isToday ? "border-success/60 ring-4 ring-success/20" : "border-primary/40")}>
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-3xl" aria-hidden>
          <ItemIcon image={DAY_IMAGES[day]} emoji={DAY_ICON[day]} className="size-12" />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wider text-ink-muted uppercase">
            {dayLabel(day, dict)}
            {isToday && <span className="chip bg-success-soft text-success normal-case">● {dict["prep.today"]}</span>}
          </p>
          <h2 className="text-xl/tight font-black wrap-break-word text-ink md:text-2xl">{dict[`prep.theme.${day}`]}</h2>
          {themeAlt(day, dict) && <p className="text-sm font-bold wrap-break-word text-ink-muted">({themeAlt(day, dict)})</p>}
          {round && <DayTimes day={day} round={round} dict={dict} locale={locale} />}
        </div>
        <DayTimer day={day} dict={dict} large />
      </header>

      <div className="mt-5 space-y-5">
        {day === 0 && <p className="rounded-2xl bg-card-soft px-4 py-3 text-sm font-bold text-ink">{dict["prep.eveNote"]}</p>}

        {plan.best.length > 0 && (
          <Group icon={MARK_ICON.best} title={dict["prep.group.best"]}>
            <ItemGrid>
              {plan.best.map((item) => (
                <ItemSticker key={item.id} item={item} tone="bg-success-soft" dict={dict} locale={locale} day={scoringDay} />
              ))}
            </ItemGrid>
          </Group>
        )}

        {plan.ok.length > 0 && (
          <Group icon={MARK_ICON.ok} title={dict["prep.group.ok"]}>
            <ItemGrid>
              {plan.ok.map(({ item, bestDay }) => (
                <ItemSticker
                  key={item.id}
                  item={item}
                  tone="bg-primary-soft"
                  dict={dict}
                  locale={locale}
                  day={scoringDay}
                  note={bestDay ? format(dict["prep.bestOn"], { n: bestDay }) : undefined}
                />
              ))}
            </ItemGrid>
          </Group>
        )}

        {plan.wait.length > 0 && (
          <Group icon={MARK_ICON.wait} title={dict["prep.group.wait"]}>
            <ItemGrid>
              {plan.wait.map(({ item, day: next }) => (
                <ItemSticker key={item.id} item={item} tone="bg-gold-soft" dict={dict} note={<NextDay day={next} dict={dict} />} />
              ))}
            </ItemGrid>
          </Group>
        )}

        {stackFor && <IntelStacking day={day} target={stackFor} round={round} dict={dict} locale={locale} />}

        {tips.length > 0 && (
          <Group icon="❗" title={dict["prep.group.tips"]}>
            <TipList tips={tips} dict={dict} />
          </Group>
        )}

        {plan.no.length > 0 && (
          <Group icon={MARK_ICON.no} title={dict["prep.group.no"]}>
            <ul className="flex flex-wrap gap-2">
              {plan.no.map(({ item, day: next }) => (
                <li key={item.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-card-soft py-1 ps-1.5 pe-3 text-xs font-bold text-ink-muted">
                  <span className="grid size-6 shrink-0 place-items-center text-base" aria-hidden>
                    <ItemIcon image={ITEM_IMAGES[item.id]} emoji={item.icon} className="size-6" />
                  </span>
                  <span className="min-w-0 wrap-break-word">{dict[`prep.item.${item.id}`]}</span>
                  <NextDay day={next} dict={dict} />
                </li>
              ))}
            </ul>
          </Group>
        )}
      </div>
    </article>
  );
}

/**
 * One day's own countdown, ticking every second: ⏳ to its start, ● to its end
 * while it runs, ✓ once over. Small under a day tab, `large` in the day panel.
 * Nothing until hydrated (the space is kept so the tabs don't jump).
 */
function DayTimer({ day, dict, large = false }: { day: PrepDay; dict: Dictionary; large?: boolean }) {
  const now = useNow(1000);
  if (!now) return <span className={large ? "hidden" : "block h-4"} aria-hidden />;
  const { state, at } = dayCountdown(roundFor(now), day, now);
  const label = state === "upcoming" ? dict["time.startsIn"] : state === "live" ? dict["time.endsIn"] : dict["time.ended"];
  const tone = state === "live" ? "text-success" : state === "done" ? "text-ink-faint" : "text-ink-muted";

  if (large) {
    return (
      <div className={clsx("w-full rounded-2xl px-4 py-2.5 sm:w-auto", state === "live" ? "bg-success-soft" : "bg-card-soft")}>
        <p className={clsx("text-xs font-bold tracking-wider uppercase", tone)}>{label}</p>
        {state === "done" ? (
          <p className="text-lg font-black text-ink-faint">✓</p>
        ) : (
          <div className="mt-0.5 text-ink">
            <DurationUnits ms={at.getTime() - now.getTime()} dict={dict} />
          </div>
        )}
      </div>
    );
  }
  return (
    <span className={clsx("block text-[0.6875rem] font-extrabold tabular", tone)}>
      <span className="sr-only">{label} </span>
      {state === "done" ? (
        <span aria-hidden>✓ {dict["time.ended"]}</span>
      ) : (
        <CompactCountdown ms={at.getTime() - now.getTime()} icon={state === "live" ? "●" : "⏳"} dict={dict} />
      )}
    </span>
  );
}

/**
 * "⏳ 2d 15:59:57". The days part is isolated (`bdi`): in Arabic its letter
 * would otherwise pull the clock digits after it into right-to-left order.
 */
function CompactCountdown({ ms, icon, dict }: { ms: number; icon: string; dict: Dictionary }) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  return (
    <span dir="ltr">
      <span aria-hidden>{icon} </span>
      {days > 0 && <bdi>{`${days}${dict["common.daysShort"]}`}</bdi>} {`${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`}
    </span>
  );
}

/** "Wed, Nov 4 · 00:00–24:00 UTC" for a whole UTC day, else "Mon, Nov 2 00:00 – Sat, Nov 7 10:00 UTC". */
function utcSpan(start: Date, end: Date, locale: string): string {
  const time = (d: Date) => `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  if (end.getTime() - start.getTime() === DAY && time(start) === "00:00") return `${formatUtcDate(start, locale)} · 00:00–24:00 UTC`;
  return `${formatUtcDate(start, locale)} ${time(start)} – ${formatUtcDate(end, locale)} ${formatUtcTime(end)}`;
}

/** The day's window in UTC and in the visitor's time (only once the clock has picked the round). */
function DayTimes({ day, round, dict, locale }: { day: PrepDay; round: PrepRound; dict: Dictionary; locale: string }) {
  const start = dayStart(round, day);
  const end = dayEnd(round, day);
  return (
    <p className="mt-1 text-xs font-semibold text-ink-muted">
      <span className="font-bold text-ink">{utcSpan(start, end, locale)}</span>
      <span className="mx-1.5 text-ink-faint">·</span>
      {format(dict["prep.yourTime"], { time: `${formatLocalDateTime(start, locale)} – ${formatLocalDateTime(end, locale)}` })}
    </p>
  );
}

/** The intel stacking schedule of the day before an intel day: one row per batch, Master Pan in the 16:00 row. */
function IntelStacking({ day, target, round, dict, locale }: { day: PrepDay; target: ScoringDay; round: PrepRound | null; dict: Dictionary; locale: string }) {
  const yesNo = (ok: boolean) => (ok ? "✅" : "❌");
  return (
    <Group icon={<ItemIcon image={ITEM_IMAGES.intel} emoji="🕵️" className="size-6" />} title={dict["prep.intel.title"]}>
      <p className="-mt-1 mb-2 text-sm font-semibold text-ink-muted">{format(dict["prep.intel.hint"], { day: target })}</p>
      <ol className="grid grid-cols-1 gap-2">
        {INTEL_STACK_STEPS.map((step) => {
          const at = round ? new Date(dayStart(round, day).getTime() + step.hour * HOUR) : null;
          const opening = step.id === "open";
          return (
            <li key={step.id} className={clsx("flex items-start gap-3 rounded-2xl px-3 py-2.5", opening ? "border-2 border-success/50 bg-success-soft" : "bg-card-soft")}>
              <span className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-card px-1 py-1.5 text-center shadow-soft" dir="ltr">
                <span className="text-sm font-black text-ink tabular">{`${pad2(step.hour % 24)}:00`}</span>
                <span className="text-[0.625rem] font-bold text-ink-faint">UTC</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  {opening && <span className="chip bg-success text-card">{dayLabel(target, dict)}</span>}
                  {(["complete", "claim"] as const).map((what) => (
                    <span key={what} className={clsx("chip", step[what] ? "bg-card text-success" : "bg-danger-soft text-danger")}>
                      <span aria-hidden>{yesNo(step[what])}</span> {dict[`prep.intel.${what}`]}
                      <span className="sr-only">: {dict[step[what] ? "prep.intel.yes" : "prep.intel.no"]}</span>
                    </span>
                  ))}
                </span>
                <span className="mt-1 block text-sm font-bold wrap-break-word text-ink">{format(dict[`prep.intel.step.${step.id}`], { day: target })}</span>
                {at && (
                  <span className="block text-xs font-semibold text-ink-muted">{format(dict["prep.yourTime"], { time: formatLocalDateTime(at, locale) })}</span>
                )}
              </span>
              {step.id === "keepMissions" && (
                <span className="shrink-0 overflow-hidden rounded-xl border-2 border-gold bg-card shadow-[0_3px_0_0_var(--gold-strong)]">
                  <ItemIcon image={MASTER_PAN_IMAGE} emoji="🧙" className="size-11" />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Group>
  );
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-black tracking-wider text-ink-muted uppercase">
        <span className="grid size-6 shrink-0 place-items-center text-base" aria-hidden>
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ItemGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</ul>;
}

/** One item of a day list; with `locale` and `day`, its points on that day are shown under the name. */
function ItemSticker({ item, tone, note, dict, locale, day }: { item: PrepItem; tone: string; note?: ReactNode; dict: Dictionary; locale?: string; day?: ScoringDay }) {
  const points = locale && day ? pointsOn(item.id, day) : undefined;
  return (
    <li className={clsx("flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2", tone)}>
      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-card text-xl shadow-soft" aria-hidden>
        <ItemIcon image={ITEM_IMAGES[item.id]} emoji={item.icon} className="size-11" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold wrap-break-word text-ink">{dict[`prep.item.${item.id}`]}</span>
        {points && locale && (
          <span className="mt-0.5 block text-xs font-bold wrap-break-word text-ink">
            <span aria-hidden>⭐ </span>
            {pointsText(points, dict, locale)}
          </span>
        )}
        {note && <span className="block text-xs font-bold text-ink-muted">{note}</span>}
      </span>
    </li>
  );
}

function NextDay({ day, dict }: { day: ScoringDay | null; dict: Dictionary }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <ArrowRight className="size-3 rtl:rotate-180" aria-hidden />
      {day ? dayLabel(day, dict) : dict["prep.nextRound"]}
    </span>
  );
}

function TipList({ tips, dict }: { tips: ReadonlyArray<Parameters<typeof tipText>[0]>; dict: Dictionary }) {
  return (
    <ul className="grid grid-cols-1 gap-2">
      {tips.map((tip) => (
        <li key={`${tip.id}-${tip.day ?? ""}`} className="flex items-start gap-3 rounded-2xl bg-gold-soft px-4 py-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-base" aria-hidden>
            <ItemIcon image={TIP_IMAGES[tip.id]} emoji="❗" className="size-6 max-w-none rounded-md" />
          </span>
          <span className="min-w-0 text-sm font-bold wrap-break-word text-ink">{tipText(tip, dict)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The item × day table, today's column highlighted. */
function PrepTable({ today, dict }: { today: PrepDay | null; dict: Dictionary }) {
  const tone = { best: "bg-success-soft", ok: "bg-primary-soft", wait: "bg-gold-soft", no: "" } as const;
  return (
    <div className="card p-2 sm:p-4">
      {/* Fixed layout: the day columns keep their width and long item names (German, largest text) wrap instead of widening the page. */}
      <table className="w-full table-fixed border-separate border-spacing-y-1 text-sm">
        <thead>
          <tr>
            <th scope="col" className="px-2 pb-1 text-start text-xs font-black tracking-wider text-ink-muted uppercase">
              {dict["prep.tableItem"]}
            </th>
            {SCORING_DAYS.map((day) => (
              <th key={day} scope="col" className="w-8 px-0 pb-1 sm:w-14">
                <span
                  className={clsx(
                    "mx-auto grid size-7 place-items-center rounded-full text-xs font-black",
                    day === today ? "bg-success text-card" : "bg-card-soft text-ink-muted",
                  )}
                  title={dayLabel(day, dict)}
                >
                  <span className="sr-only">{dayLabel(day, dict)}</span>
                  <span aria-hidden>{day}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PREP_ITEMS.map((item) => (
            <tr key={item.id}>
              <th scope="row" className="rounded-s-xl bg-card-soft px-2 py-1.5 text-start font-bold text-ink">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center text-base" aria-hidden>
                    <ItemIcon image={ITEM_IMAGES[item.id]} emoji={item.icon} className="size-6" />
                  </span>
                  <span className="min-w-0 wrap-break-word hyphens-auto">{dict[`prep.item.${item.id}`]}</span>
                </span>
              </th>
              {SCORING_DAYS.map((day, index) => {
                const mark = markOn(item, day);
                return (
                  <td
                    key={day}
                    className={clsx(
                      "bg-card-soft px-0.5 py-1 text-center",
                      index === SCORING_DAYS.length - 1 && "rounded-e-xl",
                      day === today && "bg-success-soft/70",
                    )}
                  >
                    <span className={clsx("mx-auto grid size-7 place-items-center rounded-lg text-base leading-none", tone[mark])} title={dict[`prep.mark.${mark}`]}>
                      <span aria-hidden>{MARK_ICON[mark]}</span>
                      <span className="sr-only">{dict[`prep.mark.${mark}`]}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs font-bold text-ink-muted">
        {(["best", "ok", "wait", "no"] as const).map((mark) => (
          <span key={mark} className="inline-flex items-center gap-1">
            <span aria-hidden>{MARK_ICON[mark]}</span> {dict[`prep.mark.${mark}`]}
          </span>
        ))}
      </p>
    </div>
  );
}
