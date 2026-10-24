"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { toUtcInputValue } from "@/lib/admin/forms";
import { saveRetrospective } from "@/lib/admin/retro-actions";
import type { AdminRetrospective } from "@/lib/admin/retro-data";
import { adminPath } from "@/lib/auth/paths";
import { pick } from "@/lib/i18n/localized";
import {
  configFieldName,
  DEFAULT_MAX_RESPONSES,
  DEFAULT_RETENTION_DAYS,
  defaultConfig,
  INTRO_MAX,
  MAX_RESPONSES_LIMIT,
  RATING_QUESTIONS,
  RETENTION_RANGE,
  TEXT_PROMPTS,
  TITLE_MAX,
} from "@/lib/retro/questions";
import { DateTimeField } from "./DateTimeField";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/**
 * The retrospective settings inside the plan editor: open/closed, title and
 * intro (English; translated by the pipeline), which questions are shown and
 * required, the cap and the retention. `labels` holds the English wording of
 * the catalogue questions so the editor shows what players will read.
 */
export function RetroSettingsForm({
  retro,
  planId,
  planTitle,
  locale,
  labels,
}: {
  retro: AdminRetrospective | null;
  planId: string;
  planTitle: string;
  locale: string;
  labels: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveRetrospective, IDLE_STATE);
  // Submitted inside a transition: React would otherwise reset the uncontrolled fields to
  // their (possibly stale) defaults once the action returns, e.g. untick "Open" right after
  // opening the form, so that the next save closed it again.
  const [, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
  const errors = state.errors ?? {};
  const config = retro?.config ?? defaultConfig();

  return (
    <form action={action} onSubmit={submit} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />

      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        {/* Keyed on the saved value: after a save the box shows what the server holds, not what it held before. */}
        <input key={`open-${String(retro?.open ?? false)}`} type="checkbox" name="open" defaultChecked={retro?.open ?? false} className="size-4" />
        Open — players can answer on /kvk/feedback (only one form can be open at a time; opening this one closes the others)
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Title (English)" htmlFor="retro-title" error={errors.title} className="md:col-span-2">
          <input id="retro-title" name="title" className="input" defaultValue={pick(retro?.title, "en") || planTitle} required maxLength={TITLE_MAX} />
        </Field>
        <DateTimeField
          id="retro-closesAt"
          name="closesAt"
          label="Closes automatically (UTC, optional)"
          defaultValue={toUtcInputValue(retro?.closesAt)}
          hint="Leave empty to close it by hand with the checkbox above."
          error={errors.closesAt}
        />
        <Field label="Maximum responses" htmlFor="retro-max" error={errors.maxResponses} hint="The form closes itself at this number; one answer per Governor ID.">
          <input id="retro-max" name="maxResponses" type="number" min={1} max={MAX_RESPONSES_LIMIT} className="input" defaultValue={retro?.maxResponses ?? DEFAULT_MAX_RESPONSES} required />
        </Field>
        <Field
          label="Keep answers for (days after the battle)"
          htmlFor="retro-retention"
          error={errors.retentionDays}
          hint="The daily Maintenance task deletes the answers after this; export them before."
        >
          <input id="retro-retention" name="retentionDays" type="number" min={RETENTION_RANGE.min} max={RETENTION_RANGE.max} className="input" defaultValue={retro?.retentionDays ?? DEFAULT_RETENTION_DAYS} required />
        </Field>
      </div>

      <Field
        label="Introduction (English, Markdown, optional)"
        htmlFor="retro-intro"
        error={errors.introSource}
        hint="A few lines above the questions: what the council wants to learn, how long it takes. Translated automatically after saving."
      >
        <textarea id="retro-intro" name="introSource" className="input min-h-28 font-mono text-sm" defaultValue={pick(retro?.introSource, "en")} maxLength={INTRO_MAX} dir="ltr" />
      </Field>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <fieldset className="min-w-0 rounded-2xl bg-card-soft p-3">
          <legend className="label float-start mb-2 w-full px-1">Rating questions (0–5 stars)</legend>
          <table className="clear-both w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-faint">
                <th className="py-1 text-start font-bold">Question</th>
                <th className="w-16 py-1 text-center font-bold">Shown</th>
                <th className="w-20 py-1 text-center font-bold">Required</th>
              </tr>
            </thead>
            <tbody>
              {RATING_QUESTIONS.map((q) => (
                <tr key={q.key} className="border-t border-line">
                  <td className="py-2 pe-2 font-semibold wrap-break-word text-ink">{labels[q.key] ?? q.key}</td>
                  <td className="py-2 text-center">
                    <input type="checkbox" name={configFieldName("rating", q.key, "shown")} defaultChecked={config.ratings[q.key].shown} className="size-4" aria-label={`Show: ${labels[q.key] ?? q.key}`} />
                  </td>
                  <td className="py-2 text-center">
                    <input type="checkbox" name={configFieldName("rating", q.key, "required")} defaultChecked={config.ratings[q.key].required} className="size-4" aria-label={`Required: ${labels[q.key] ?? q.key}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
        <fieldset className="min-w-0 rounded-2xl bg-card-soft p-3">
          <legend className="label float-start mb-2 w-full px-1">Text prompts (up to 500 characters each)</legend>
          <table className="clear-both w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-faint">
                <th className="py-1 text-start font-bold">Prompt</th>
                <th className="w-16 py-1 text-center font-bold">Shown</th>
                <th className="w-20 py-1 text-center font-bold">Required</th>
              </tr>
            </thead>
            <tbody>
              {TEXT_PROMPTS.map((t) => (
                <tr key={t.key} className="border-t border-line">
                  <td className="py-2 pe-2 font-semibold wrap-break-word text-ink">{labels[t.key] ?? t.key}</td>
                  <td className="py-2 text-center">
                    <input type="checkbox" name={configFieldName("text", t.key, "shown")} defaultChecked={config.texts[t.key].shown} className="size-4" aria-label={`Show: ${labels[t.key] ?? t.key}`} />
                  </td>
                  <td className="py-2 text-center">
                    <input type="checkbox" name={configFieldName("text", t.key, "required")} defaultChecked={config.texts[t.key].required} className="size-4" aria-label={`Required: ${labels[t.key] ?? t.key}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-faint">A hidden question is never required. Texts are optional by default: no pressure on players.</p>
        </fieldset>
      </div>
      {errors.config && <p className="text-xs font-bold text-danger">{errors.config}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{retro ? "Save feedback settings" : "Create feedback form"}</SubmitButton>
        <button type="reset" className="btn-ghost btn-sm">
          Discard changes
        </button>
        {retro && (
          <Link href={adminPath(locale, `/feedback/${planId}`)} className="btn-ghost btn-sm">
            Results ({retro.responseCount}) →
          </Link>
        )}
        <Notice state={state} />
      </div>
    </form>
  );
}
