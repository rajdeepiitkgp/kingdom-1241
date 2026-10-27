"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { toUtcInputValue } from "@/lib/admin/forms";
import { savePlan } from "@/lib/admin/kvk-actions";
import type { AdminKvkPlan } from "@/lib/admin/kvk-data";
import { adminPath } from "@/lib/auth/paths";
import { pick } from "@/lib/i18n/localized";
import { STANDARD_BATTLE, standardWindow } from "@/lib/kvk/battle-window";
import { DateTimeField } from "./DateTimeField";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

export function PlanForm({ plan, locale }: { plan: AdminKvkPlan | null; locale: string }) {
  const [state, action] = useActionState<ActionState, FormData>(savePlan, IDLE_STATE);
  // Submitted inside a transition so React doesn't reset the fields to stale defaults after a save (see RetroSettingsForm).
  const [, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
  const errors = state.errors ?? {};
  // "Standard window": fills 12:00–17:00 UTC on the chosen day (or the next one); both stay editable.
  const [windowFill, setWindowFill] = useState<{ start: { value: string; key: number }; end: { value: string; key: number } } | null>(null);
  const fillStandardWindow = (event: React.MouseEvent<HTMLButtonElement>) => {
    const typed = (event.currentTarget.form?.elements.namedItem("battleAt") as HTMLInputElement | null)?.value ?? "";
    const { start, end } = standardWindow(typed, new Date());
    const key = Date.now();
    setWindowFill({ start: { value: start, key }, end: { value: end, key } });
  };
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
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
          fill={windowFill?.start}
        />
        <DateTimeField
          id="battleEndAt"
          name="battleEndAt"
          label="Battle ends (UTC)"
          defaultValue={toUtcInputValue(plan?.battleEndAt)}
          hint="Optional, after the start (it may already be over). After this time the page says the battle is over; without it, it keeps saying battle day."
          error={errors.battleEndAt}
          allowPast
          fill={windowFill?.end}
        />
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button type="button" className="btn-ghost btn-sm" onClick={fillStandardWindow}>
            Standard window: {hh(STANDARD_BATTLE.startHourUtc)}–{hh(STANDARD_BATTLE.endHourUtc)} UTC
          </button>
          <span className="text-xs text-ink-faint">On the start date you picked (or the next day). Change either time afterwards if this battle differs.</span>
        </div>
        <Field label="Minimum hero stars" htmlFor="minHeroStars" error={errors.minHeroStars}>
          <input id="minHeroStars" name="minHeroStars" type="number" min={0} max={5} className="input" defaultValue={plan?.minHeroStars ?? 4} required />
        </Field>
        <Field label="Top expedition skill level" htmlFor="minSkillLevel" error={errors.minSkillLevel} hint="The top-right skill with the flag icon.">
          <input id="minSkillLevel" name="minSkillLevel" type="number" min={0} max={5} className="input" defaultValue={plan?.minSkillLevel ?? 5} required />
        </Field>
        <Field label="Shared password" htmlFor="password" error={errors.password} hint="Changing it logs every player out of the plan page.">
          <input id="password" name="password" className="input" defaultValue={plan?.password ?? ""} required minLength={4} maxLength={64} autoComplete="off" />
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
          <input key={`active-${String(plan?.active ?? false)}`} type="checkbox" name="active" defaultChecked={plan?.active ?? false} className="size-4" />
          Active — the plan players see on /kvk (only one can be active)
        </label>
        <label className="flex items-center gap-2">
          <input key={`published-${String(plan?.published ?? true)}`} type="checkbox" name="published" defaultChecked={plan?.published ?? true} className="size-4" />
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
