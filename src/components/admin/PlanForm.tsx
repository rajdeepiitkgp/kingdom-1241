"use client";

import Link from "next/link";
import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { toUtcInputValue } from "@/lib/admin/forms";
import { savePlan } from "@/lib/admin/kvk-actions";
import type { AdminKvkPlan } from "@/lib/admin/kvk-data";
import { adminPath } from "@/lib/auth/paths";
import { pick } from "@/lib/i18n/localized";
import { DateTimeField } from "./DateTimeField";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

export function PlanForm({ plan, locale }: { plan: AdminKvkPlan | null; locale: string }) {
  const [state, action] = useActionState<ActionState, FormData>(savePlan, IDLE_STATE);
  const errors = state.errors ?? {};
  return (
    <form action={action} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      {plan && <input type="hidden" name="id" value={plan.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Title (English)" htmlFor="title" error={errors.title}>
          <input id="title" name="title" className="input" defaultValue={pick(plan?.title, "en")} required maxLength={120} />
        </Field>
        <Field label="Event" htmlFor="eventType">
          <select id="eventType" name="eventType" className="input select-chevron" defaultValue={plan?.eventType ?? "castle_battle"}>
            <option value="castle_battle">Castle battle (inside 1241)</option>
            <option value="kvk">KvK (against another kingdom)</option>
          </select>
        </Field>
        <Field label="Opponent" htmlFor="opponent" hint="KvK only, e.g. Kingdom 1198.">
          <input id="opponent" name="opponent" className="input" defaultValue={plan?.opponent ?? ""} maxLength={60} />
        </Field>
        <DateTimeField
          id="battleAt"
          name="battleAt"
          label="Battle starts (UTC)"
          defaultValue={toUtcInputValue(plan?.battleAt)}
          hint="Enter the UTC time, in the future; players see it in their own time zone."
          error={errors.battleAt}
        />
        <Field label="Minimum hero stars" htmlFor="minHeroStars" error={errors.minHeroStars}>
          <input id="minHeroStars" name="minHeroStars" type="number" min={0} max={5} className="input" defaultValue={plan?.minHeroStars ?? 4} required />
        </Field>
        <Field label="Top expedition skill level" htmlFor="minSkillLevel" error={errors.minSkillLevel} hint="The top-right skill with the flag icon.">
          <input id="minSkillLevel" name="minSkillLevel" type="number" min={0} max={5} className="input" defaultValue={plan?.minSkillLevel ?? 5} required />
        </Field>
        <Field label="Shared password" htmlFor="password" error={errors.password} hint="Changing it logs every player out of the plan page.">
          <input id="password" name="password" className="input" defaultValue={plan?.password ?? ""} required minLength={3} maxLength={64} autoComplete="off" />
        </Field>
        <Field label="Slug (name in the database)" htmlFor="slug" error={errors.slug} hint="Leave empty to derive it from the title.">
          <input id="slug" name="slug" className="input" defaultValue={plan?.slug ?? ""} maxLength={60} dir="ltr" />
        </Field>
      </div>

      <Field
        label="Introduction (English, Markdown)"
        htmlFor="introSource"
        hint="**bold**, *italics*, lists with “- ”, quotes with “> ”. Write {{when}}, {{date}}, {{time}} or {{utc}} instead of “tomorrow” or a time: every player sees the battle time in their own words and time zone (“tomorrow”, “Sunday, November 8”, “15:00”, “14:00 UTC”), so the text never goes stale. Translated into the other languages automatically after saving."
      >
        <textarea id="introSource" name="introSource" className="input min-h-56 font-mono text-sm" defaultValue={plan?.introSource ?? ""} dir="ltr" />
      </Field>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={plan?.active ?? false} className="size-4" />
          Active — the plan players see on /kvk (only one can be active)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="published" defaultChecked={plan?.published ?? true} className="size-4" />
          Published
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{plan ? "Save plan" : "Create plan"}</SubmitButton>
        <button type="reset" className="btn-ghost btn-sm">
          Discard changes
        </button>
        <Link href={adminPath(locale, "/kvk")} className="btn-ghost btn-sm">
          Back to plans
        </Link>
        <Notice state={state} />
      </div>
    </form>
  );
}
