// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { type AdminSection as SectionData, DisabledList, EntryForm, RoundForm, SignupList } from "@/components/admin/MinistryAdmin";
import { AdminSection } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { toUtcInputValue } from "@/lib/admin/forms";
import { getMinistryAdmin } from "@/lib/admin/ministry-data";
import { sectionName } from "@/lib/admin/ministry-labels";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getAlliances } from "@/lib/data";
import { dayStart, type PrepRound } from "@/lib/kvk/prep";
import { defaultDeadline, MAX_SIGNUPS_PER_ROUND, rankSection, sectionOn, slotDemand, slotLabel, SLOTS_PER_DAY } from "@/lib/ministry/ministry";
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
  const [data, alliances] = await Promise.all([getMinistryAdmin(first(query.round), new Date()), getAlliances()]);
  if (!data) return null;
  const { rounds, selected, signups } = data;
  const titles = ["This round", "Next round"];
  const sections = sectionData(selected);
  const section = sections.find((entry) => String(entry.day) === first(query.day)) ?? sections[0];
  const ranked = rankSection(signups, sectionOn(selected.sections, section.day) ?? section);
  const demand = slotDemand(ranked, section.day);
  const uncovered = demand.filter((count) => count === 0).length;
  const disabled = signups.filter((signup) => signup.disabled);
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
        <nav className="mb-4 flex flex-wrap gap-x-2 gap-y-3" aria-label="Buff day" data-tour="ministry-admin-days">
          {sections.map((entry) => (
            <Link key={entry.day} href={href(selected.key, entry.day)} scroll={false} aria-current={entry.day === section.day ? "page" : undefined} className={clsx("btn-ghost btn-sm", entry.day === section.day && "border-primary text-primary-strong")}>
              {sectionName(entry)} · Day {entry.day}
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

        <SignupList rows={ranked} section={section} sections={sections} roundKey={selected.key} alliances={allianceList} locale={locale} />
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
    </div>
  );
}
