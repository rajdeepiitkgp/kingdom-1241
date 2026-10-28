// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatDuration } from "@/components/time/DurationLabel";
import { useNow } from "@/components/time/useNow";
import { ItemIcon } from "@/components/kvk/ItemIcon";
import { CALENDAR_IMAGE, phaseView } from "@/components/kvk/prep-labels";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { prepPhase } from "@/lib/kvk/prep";

/** Entry point to the public KvK prep page, with where the round stands right now. */
export function PrepCard({ dict, locale }: { dict: Dictionary; locale: string }) {
  const now = useNow(1000);
  const phase = now ? prepPhase(now) : null;
  const view = phase ? phaseView(phase, dict) : null;

  return (
    <Link
      href={localePath(locale, "/kvk/prep")}
      data-tour="home-prep"
      className="card group relative flex items-center gap-4 overflow-hidden border-2 border-primary/50 p-5 transition-shadow hover:shadow-lift md:p-6"
    >
      <div className="pointer-events-none absolute -inset-e-10 -top-10 size-32 rounded-full bg-primary/20 blur-2xl" aria-hidden />
      <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-3xl shadow-[0_4px_0_0_var(--primary-strong)]" aria-hidden>
        <ItemIcon image={view?.image ?? CALENDAR_IMAGE} emoji={view?.icon ?? "📅"} className="size-12" />
      </span>
      <div className="relative min-w-0 flex-1">
        <p className="text-lg font-black wrap-break-word text-ink">{dict["prep.title"]}</p>
        <p className="mt-0.5 min-h-5 text-sm font-semibold wrap-break-word text-ink-muted" suppressHydrationWarning>
          {phase && view && now ? (
            <>
              {phase.kind === "day" && <span className="font-extrabold text-ink">{`${view.eyebrow} · ${view.title} · `}</span>}
              {phase.kind !== "day" && phase.kind !== "before" && <span className="font-extrabold text-ink">{`${view.title} · `}</span>}
              <span className="tabular">
                {view.countdown} {formatDuration(phase.until.getTime() - now.getTime(), dict)}
              </span>
            </>
          ) : (
            dict["prep.subtitle"]
          )}
        </p>
      </div>
      <span className="btn-primary btn-sm hidden shrink-0 sm:inline-flex">
        {dict["home.prepCard.open"]} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </span>
      <ArrowRight className="size-5 shrink-0 text-primary sm:hidden rtl:rotate-180" aria-hidden />
    </Link>
  );
}
