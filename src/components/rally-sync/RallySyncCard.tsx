// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { ArrowRight, Timer } from "lucide-react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";

/** The Tools page's entry to Rally Sync (the tool has its own pages). */
export function RallySyncCard({ dict, locale }: { dict: Dictionary; locale: string }) {
  return (
    <section className="card p-5 md:p-6" aria-labelledby="rally-sync-title">
      <header className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold-ink">
          <Timer className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="rally-sync-title" className="text-xl font-extrabold text-ink">
            {dict["sync.title"]}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{dict["sync.card.body"]}</p>
        </div>
      </header>
      <Link href={localePath(locale, "/tools/rally-sync")} className="btn-gold mt-4">
        {dict["sync.card.open"]}
        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
    </section>
  );
}
