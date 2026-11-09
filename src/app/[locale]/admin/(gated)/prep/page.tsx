// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { PrepScheduleForm } from "@/components/admin/PrepScheduleForm";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { requireEditor } from "@/lib/auth/server";
import { getPrepSchedules } from "@/lib/config/settings";
import { BUFF_DAYS, type BuffDay, dayStart, type PrepRound, TRAINING_DAY } from "@/lib/kvk/prep";
import { offeredRounds, roundKey, scheduleFor } from "@/lib/kvk/prep-schedule";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Prep days" };

export default async function AdminPrepPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <PrepSettings locale={locale} />
    </Suspense>
  );
}

const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Sun 1 Nov – Sat 7 Nov" of a round, UTC. */
function roundSpan(round: PrepRound): string {
  return `${DATE.format(round.start)} – ${DATE.format(round.invasionAt)}`;
}

function buffDates(round: PrepRound): Record<BuffDay, string> {
  return Object.fromEntries(BUFF_DAYS.map((day) => [day, DATE.format(dayStart(round, day))])) as Record<BuffDay, string>;
}

async function PrepSettings({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  await connection();
  const { current, next } = offeredRounds(new Date());
  const schedules = await getPrepSchedules();
  const rounds = [
    { round: current, title: `This round · ${roundSpan(current)}` },
    { round: next, title: `Next round · ${roundSpan(next)}` },
  ];

  return (
    <div className="space-y-5">
      <SectionTitle icon="📅" title="KvK prep buff days" />
      <p className="text-sm font-semibold text-ink-muted">
        The game scores Truegold, Tempered Truegold and construction speedups, and Truegold Dust and research speedups, on Days 1, 2 and 5 alike; the
        king&apos;s minister buffs decide which of those days the kingdom uses. Every player sees those items ticked on all three days; whoever has unlocked the
        battle plan sees the days set here, marked ✅ in the prep page&apos;s table (the other two days 🆗). The training buff is Day 4 by the game and isn&apos;t
        asked. Both buffs may fall on the same day.
      </p>
      {!isSupabaseAdminConfigured() && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">The prep days need the database: without it every round follows the template.</p>
      )}
      {rounds.map(({ round, title }) => {
        const key = roundKey(round);
        return (
          <PrepScheduleForm
            key={key}
            roundKey={key}
            title={title}
            dates={buffDates(round)}
            trainingDate={DATE.format(dayStart(round, TRAINING_DAY))}
            schedule={scheduleFor(schedules, round)}
            set={key in schedules}
            locale={locale}
          />
        );
      })}
    </div>
  );
}
