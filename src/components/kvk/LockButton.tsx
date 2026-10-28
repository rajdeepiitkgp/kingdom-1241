"use client";

import { LockKeyhole } from "lucide-react";
import type { KvkArea } from "@/lib/kvk/access";
import { lockChecklist, lockKvk, lockLeaders } from "@/lib/kvk/actions";

const ACTIONS = { plan: lockKvk, leaders: lockLeaders, checklist: lockChecklist } satisfies Record<KvkArea, unknown>;

/** Clears the page's access cookie (for shared devices). The page re-renders locked. */
export function LockButton({ label, area = "plan" }: { label: string; area?: KvkArea }) {
  return (
    <form action={ACTIONS[area]} data-tour="kvk-lock">
      <button type="submit" className="btn-ghost btn-sm">
        <LockKeyhole className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
