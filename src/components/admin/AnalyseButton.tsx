"use client";

import { Languages, LoaderCircle, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { analyseRetrospective, translateRetrospective } from "@/lib/admin/retro-actions";
import { Notice } from "./ui";

const MODES = {
  analyse: { action: analyseRetrospective, Icon: Sparkles, pending: "Analysing… this can take a minute" },
  translate: { action: translateRetrospective, Icon: Languages, pending: "Translating…" },
};

/**
 * Runs the AI step: "translate" stores English versions of new answers (any
 * moderator), "analyse" also writes the summary (the owner only; the server
 * checks again). Deliberately a click, never automatic: every run costs tokens.
 */
export function AnalyseButton({
  mode,
  planId,
  locale,
  label,
  hint,
  disabledReason,
}: {
  mode: keyof typeof MODES;
  planId: string;
  locale: string;
  label: string;
  hint: string;
  disabledReason: string | null;
}) {
  const { action: run, Icon, pending: pendingLabel } = MODES[mode];
  const [state, action, pending] = useActionState<ActionState, FormData>(run, IDLE_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={mode === "analyse" ? "btn-primary btn-sm" : "btn-ghost btn-sm"} disabled={pending || disabledReason !== null} aria-busy={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
          <span>{pending ? pendingLabel : label}</span>
        </button>
        <span className="text-xs font-semibold text-ink-faint">{disabledReason ?? hint}</span>
      </div>
      <Notice state={state} />
    </form>
  );
}
