"use client";

import { useActionState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveChecklistBrief, saveLeaderBrief } from "@/lib/admin/kvk-actions";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { CodeSuggestInput } from "@/components/ui/CodeSuggestInput";

/** The fields of a page brief the form shows (the leader page's or the checklist's). */
export interface PageBrief {
  password: string;
  /** English Markdown source of the instructions. */
  introSource: string;
  published: boolean;
}

const PAGES = {
  leaders: {
    action: saveLeaderBrief,
    passwordLabel: "Leaders' password",
    passwordHint: "Only for the rally leaders, and different from the battle-plan and checklist passwords. Changing it logs every leader out of this page.",
    introLabel: "Instructions for the leaders (English, Markdown)",
    introHint:
      "Shown above the rallies. **bold**, *italics*, lists with “- ”. {{when}}, {{date}}, {{time}} and {{utc}} show the battle time in each leader's own words and time zone. Translated automatically after saving.",
    published: "Published — leaders can open the page while this plan is active",
    save: "Save leader page",
    create: "Create leader page",
  },
  checklist: {
    action: saveChecklistBrief,
    passwordLabel: "Checklist password",
    passwordHint:
      "Only for the battle commander and the coordinators, and different from the battle-plan and rally-leader passwords. Changing it logs everyone out of this page.",
    introLabel: "Commander's brief (English, Markdown)",
    introHint:
      "Shown above the checklist. **bold**, *italics*, lists with “- ”. {{when}}, {{date}}, {{time}} and {{utc}} show the battle time in each reader's own words and time zone. Translated automatically after saving.",
    published: "Published — the commander and coordinators can open the page while this plan is active",
    save: "Save checklist page",
    create: "Create checklist page",
  },
} as const;

/** A locked page's own password and the instructions above its content (rally-leader page, commander checklist). */
export function PageBriefForm({ area, locale, planId, brief }: { area: keyof typeof PAGES; locale: string; planId: string; brief: PageBrief | null }) {
  const page = PAGES[area];
  const [state, action] = useActionState<ActionState, FormData>(page.action, IDLE_STATE);
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

      <Field label={page.passwordLabel} htmlFor={`${area}-password`} error={errors.password} hint={page.passwordHint}>
        <CodeSuggestInput
          id={`${area}-password`}
          name="password"
          className="md:max-w-sm"
          defaultValue={brief?.password ?? ""}
          required
          minLength={4}
          maxLength={64}
          autoComplete="off"
          dir="ltr"
          suggestLabel="Suggest" suggestHint="Fill in a random six-digit code"
        />
      </Field>

      <Field label={page.introLabel} htmlFor={`${area}-intro`} error={errors.introSource} hint={page.introHint}>
        <textarea id={`${area}-intro`} name="introSource" className="input min-h-40 font-mono text-sm" defaultValue={brief?.introSource ?? ""} dir="ltr" />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input key={`published-${String(brief?.published ?? true)}`} type="checkbox" name="published" defaultChecked={brief?.published ?? true} className="size-4" />
        {page.published}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{brief ? page.save : page.create}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
