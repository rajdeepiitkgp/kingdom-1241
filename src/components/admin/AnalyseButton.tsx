"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { analyseRetrospective } from "@/lib/admin/retro-actions";
import { Notice } from "./ui";

/** Runs the AI step (translate new responses, then summarise). Deliberately a click, never automatic: every run costs tokens. */
export function AnalyseButton({ planId, locale, label, hint, disabledReason }: { planId: string; locale: string; label: string; hint: string; disabledReason: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(analyseRetrospective, IDLE_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary btn-sm" disabled={pending || disabledReason !== null} aria-busy={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          <span>{pending ? "Analysing… this can take a minute" : label}</span>
        </button>
        <span className="text-xs font-semibold text-ink-faint">{disabledReason ?? hint}</span>
      </div>
      <Notice state={state} />
    </form>
  );
}
