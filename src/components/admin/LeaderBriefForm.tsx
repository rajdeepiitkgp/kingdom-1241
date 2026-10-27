"use client";

import { useActionState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveLeaderBrief } from "@/lib/admin/kvk-actions";
import type { AdminLeaderPlan } from "@/lib/admin/kvk-data";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/** The rally-leader page's own password and the leaders' instructions. */
export function LeaderBriefForm({ locale, planId, brief }: { locale: string; planId: string; brief: AdminLeaderPlan["brief"] }) {
  const [state, action] = useActionState<ActionState, FormData>(saveLeaderBrief, IDLE_STATE);
  // Submitted inside a transition so React doesn't reset the fields to stale defaults after a save (see PlanForm).
  const [, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
  const errors = state.errors ?? {};
  return (
    <form action={action} onSubmit={submit} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />

      <Field
        label="Leaders' password"
        htmlFor="leader-password"
        error={errors.password}
        hint="Only for the rally leaders, and different from the battle-plan password. Changing it logs every leader out of this page."
      >
        <input
          id="leader-password"
          name="password"
          className="input md:max-w-sm"
          defaultValue={brief?.password ?? ""}
          required
          minLength={4}
          maxLength={64}
          autoComplete="off"
        />
      </Field>

      <Field
        label="Instructions for the leaders (English, Markdown)"
        htmlFor="leader-intro"
        error={errors.introSource}
        hint="Shown above the rallies. **bold**, *italics*, lists with “- ”. {{when}}, {{date}}, {{time}} and {{utc}} show the battle time in each leader's own words and time zone. Translated automatically after saving."
      >
        <textarea id="leader-intro" name="introSource" className="input min-h-40 font-mono text-sm" defaultValue={brief?.introSource ?? ""} dir="ltr" />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input key={`published-${String(brief?.published ?? true)}`} type="checkbox" name="published" defaultChecked={brief?.published ?? true} className="size-4" />
        Published — leaders can open the page while this plan is active
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{brief ? "Save leader page" : "Create leader page"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
