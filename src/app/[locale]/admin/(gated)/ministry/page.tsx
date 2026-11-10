// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { type AdminSection as SectionData, ClearRound, DisabledList, EntryForm, type Placement, type RosterCell, RosterPanel, type RosterPlayer, RoundForm, SignupList } from "@/components/admin/MinistryAdmin";
import { AdminSection } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { toUtcInputValue } from "@/lib/admin/forms";
import { getMinistryAdmin } from "@/lib/admin/ministry-data";
import { BUFF_NAME, RESOURCE_NAME, sectionName } from "@/lib/admin/ministry-labels";
import { adminPath } from "@/lib/auth/paths";
import { hasRole } from "@/lib/auth/roles";
import { requireEditor } from "@/lib/auth/server";
import { getAlliances } from "@/lib/data";
import { dayStart, type PrepRound } from "@/lib/kvk/prep";
import { assignDay, rosterChat, rosterOf } from "@/lib/ministry/assign";
import { BUFF_FIELDS, defaultDeadline, MAX_SIGNUPS_PER_ROUND, rankSection, scoredInPoints, sectionOn, slotDemand, slotLabel, SLOTS_PER_DAY, speedupLabel } from "@/lib/ministry/ministry";
import type { MinistryRound } from "@/lib/ministry/state";

export const metadata: Metadata = { title: "Ministry sign-ups" };

type Props = PageProps<"/[locale]/admin/ministry">;

export default async function AdminMinistryPage({ searchParams }: Props) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Ministry locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

/** "Sun 29 Nov – Sat 5 Dec" of a round, UTC. */
function roundSpan(round: PrepRound): string {
  return `${DATE.format(round.start)} – ${DATE.format(round.invasionAt)}`;
}

function sectionData(round: MinistryRound): SectionData[] {
  return round.sections.map((section) => ({
    ...section,
    date: DATE.format(dayStart(round.round, section.day)),
    start: dayStart(round.round, section.day).getTime(),
    deadline: toUtcInputValue((round.deadlines[section.day] as Date).toISOString()),
    defaultDeadline: DATE_TIME.format(defaultDeadline(round.round, section.day)),
  }));
}

const first = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

async function Ministry({ locale, searchParams }: { locale: string; searchParams: Props["searchParams"] }) {
  const query = await searchParams;
  const user = await requireEditor(locale);
  if (!user) return null;
  await connection();
  const now = new Date();
  const [data, alliances] = await Promise.all([getMinistryAdmin(first(query.round), now), getAlliances()]);
  if (!data) return null;
  const { rounds, selected, signups } = data;
  const titles = ["This round", "Next round"];
  const sections = sectionData(selected);
  const section = sections.find((entry) => String(entry.day) === first(query.day)) ?? sections[0];
  const ranked = rankSection(signups, sectionOn(selected.sections, section.day) ?? section);
  const demand = slotDemand(ranked, section.day);
  const uncovered = demand.filter((count) => count === 0).length;
  const disabled = signups.filter((signup) => signup.disabled);

  // The day's roster: stored once its assignment has run, else (sign-ups still open) how it would come out right now.
  const fullName = (signup: { allianceTag: string | null; gameName: string }) => `${signup.allianceTag ? `[${signup.allianceTag}] ` : ""}${signup.gameName}`;
  const names = new Map(signups.map((signup) => [signup.id, fullName(signup)]));
  const deadline = selected.deadlines[section.day] as Date;
  const dayClosed = now.getTime() >= deadline.getTime();
  const assigned = Boolean(data.roster.assignedAt[section.day]);
  const mode = !dayClosed ? "preview" : assigned ? "assigned" : "waiting";
  const stored = data.roster.appointments.filter((held) => held.day === section.day && names.has(held.signupId));
  const plan = mode === "preview" ? assignDay(section.day, ranked).appointments : stored;
  const number = new Intl.NumberFormat("en-GB");
  const byId = new Map(ranked.map((row) => [row.signup.id, row]));
  const inPoints = scoredInPoints(section);
  // What a player brings on this day, as the moderators' table shows it next to their time.
  const brings = (id: string): Pick<RosterCell, "brings" | "score"> => {
    const row = byId.get(id);
    if (!row) return { brings: "", score: "" };
    const parts = section.buffs.flatMap((buff) => [
      ...BUFF_FIELDS[buff].resources.map((resource) => `${RESOURCE_NAME[resource]} ${number.format(row.signup.amounts[resource])}`),
      `${BUFF_NAME[buff]} speedups ${speedupLabel(row.signup.amounts[BUFF_FIELDS[buff].speedups])}`,
    ]);
    return { brings: parts.join(" · "), score: inPoints ? `${number.format(row.score)} points` : speedupLabel(row.signup.amounts.trainingMinutes) };
  };
  const cells: Array<RosterCell | null> = rosterOf(plan, section.day).map((held) => (held ? { name: names.get(held.signupId) ?? "", source: held.source, id: held.signupId, ...brings(held.signupId) } : null));
  const players: RosterPlayer[] = ranked.map(({ signup }) => ({ id: signup.id, name: fullName(signup), own: signup.slots[section.day] ?? [] }));
  const placedIds = new Set(plan.map((held) => held.signupId));
  const unplaced = mode === "waiting" ? [] : ranked.filter(({ signup }) => !placedIds.has(signup.id)).map(({ signup }) => fullName(signup));
  const placement: Placement | undefined =
    mode === "assigned"
      ? {
          day: section.day,
          held: Object.fromEntries(stored.map((held) => [held.signupId, { slot: held.slot, source: held.source }])),
          takenBy: Object.fromEntries(stored.map((held) => [held.slot, names.get(held.signupId) ?? ""])),
        }
      : undefined;
  const chat = rosterChat(cells, `${sectionName(section)} · ${section.date} (UTC)`);
  const allianceList = alliances.filter((a) => a.published).map((a) => ({ tag: a.tag, name: a.name }));
  const href = (round: string, day?: number) => `${adminPath(locale, "/ministry")}?round=${round}${day ? `&day=${day}` : ""}`;

  return (
    <div className="space-y-5">
      <SectionTitle icon="👑" title="Ministry sign-ups" />
      <p className="text-sm font-semibold text-ink-muted">
        Players sign up on the Ministry page (KvK menu, behind the battle plan&apos;s password) for the king&apos;s buff days: what they will use and when they can take
        the 30-minute appointment. The buff days come from Prep days; here you open a round, set each day&apos;s deadline and look after the entries. Each day&apos;s
        list is ranked by the KvK points the player&apos;s numbers are worth.
      </p>
      {!data.available && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          The sign-ups could not be read: they need the database with migration 0026. Reload once the deploy has finished.
        </p>
      )}

      {rounds.map((round, index) => (
        <RoundForm key={round.key} roundKey={round.key} title={`${titles[index]} · ${roundSpan(round.round)}`} open={round.settings.open} sections={sectionData(round)} locale={locale} />
      ))}

      <AdminSection
        title={`Sign-ups · ${roundSpan(selected.round)}`}
        hint={`${signups.length} of at most ${MAX_SIGNUPS_PER_ROUND} entries in this round. Pick a round and a buff day; the list is ranked by score, and on equal scores whoever signed up first.`}
        tour="ministry-admin-list"
      >
        <nav className="mb-3 flex flex-wrap gap-x-2 gap-y-3" aria-label="Round">
          {rounds.map((round, index) => (
            <Link key={round.key} href={href(round.key)} scroll={false} aria-current={round.key === selected.key ? "page" : undefined} className={clsx("btn-ghost btn-sm", round.key === selected.key && "border-primary text-primary-strong")}>
              {titles[index]}
            </Link>
          ))}
        </nav>
        {/* The buff days as tabs: everything below belongs to the day picked. Two lines each, so "Construction + Research" on one day still reads. */}
        <nav className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-card-soft p-1.5" aria-label="Buff day" data-tour="ministry-admin-days">
          {sections.map((entry) => (
            <Link
              key={entry.day}
              href={href(selected.key, entry.day)}
              scroll={false}
              aria-current={entry.day === section.day ? "page" : undefined}
              className={clsx(
                "min-w-0 flex-1 basis-36 rounded-xl px-3 py-2 text-center transition-colors",
                entry.day === section.day ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-card hover:text-ink",
              )}
            >
              <span className="block text-sm font-extrabold wrap-break-word">{sectionName(entry)}</span>
              <span className="block text-xs font-bold opacity-80">
                Day {entry.day} · {entry.date}
              </span>
            </Link>
          ))}
        </nav>

        <div className="mb-4 space-y-1" data-tour="ministry-admin-cover">
          <p className="text-sm font-bold text-ink">
            {ranked.length} {ranked.length === 1 ? "player" : "players"} on {section.date}.{" "}
            {uncovered === 0 ? "Every one of the 48 appointments has at least one player who can take it." : `${uncovered} of the 48 appointments have nobody who can take them (red).`}
          </p>
          <div className="grid grid-cols-48 gap-px overflow-hidden rounded-lg" role="img" aria-label={`Players available per appointment; ${uncovered} without anyone`}>
            {demand.map((count, slot) => (
              <span key={slot} title={`${slotLabel(slot)} UTC: ${count} ${count === 1 ? "player" : "players"}`} className={clsx("h-6", count === 0 ? "bg-danger" : count === 1 ? "bg-gold" : "bg-success")} />
            ))}
          </div>
          <div className="flex justify-between text-xs font-semibold text-ink-faint tabular" dir="ltr" aria-hidden>
            {[0, 6, 12, 18, 24].map((hour) => (
              <span key={hour}>{slotLabel((hour * SLOTS_PER_DAY) / 24).slice(0, 5)}</span>
            ))}
          </div>
          <p className="text-xs text-ink-faint">Green: two or more players can take the appointment. Gold: one. Red: none. Hover a cell for its time.</p>
        </div>

        {data.roster.available ? (
          <div className="mb-4 border-t border-line pt-4">
            <h3 className="mb-2 text-base font-extrabold text-ink">Appointments</h3>
            <RosterPanel
              key={`${selected.key}-${section.day}`}
              roundKey={selected.key}
              day={section.day}
              title={`${sectionName(section)} · ${section.date}`}
              mode={mode}
              deadline={DATE_TIME.format(deadline)}
              cells={cells}
              unplaced={unplaced}
              chat={chat}
              locale={locale}
              placement={placement}
              players={players}
            />
          </div>
        ) : (
          data.available && <p className="mb-4 rounded-xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink">The appointments need migration 0027, which isn&apos;t applied yet. The sign-ups work as before.</p>
        )}

        <SignupList rows={ranked} section={section} sections={sections} roundKey={selected.key} alliances={allianceList} locale={locale} placement={placement} />
      </AdminSection>

      {disabled.length > 0 && (
        <AdminSection title={`Set aside (${disabled.length})`} hint="Kept, but left out of every list and of the assignment. Put one back, or remove it." tour="ministry-admin-aside">
          <DisabledList signups={disabled} sections={sections} roundKey={selected.key} alliances={allianceList} locale={locale} />
        </AdminSection>
      )}

      <AdminSection
        title="Add a sign-up by hand"
        hint={`For a player who can't use the site, or a test entry, in the round ${roundSpan(selected.round)}. A moderator's entry isn't bound by the deadlines.`}
        tour="ministry-admin-add"
      >
        <EntryForm key={`${selected.key}-${signups.length}`} roundKey={selected.key} sections={sections} alliances={allianceList} locale={locale} />
      </AdminSection>

      {hasRole(user.role, "admin") && (
        <AdminSection
          title="Start clean"
          hint={`For administrators, after testing: removes every sign-up of the round ${roundSpan(selected.round)} (the entries set aside too) with their appointments, on all its buff days. The round's switch and deadlines stay. It can't be undone.`}
          tour="ministry-admin-clean"
        >
          <ClearRound key={`${selected.key}-${signups.length}`} roundKey={selected.key} count={signups.length} locale={locale} />
        </AdminSection>
      )}
    </div>
  );
}
