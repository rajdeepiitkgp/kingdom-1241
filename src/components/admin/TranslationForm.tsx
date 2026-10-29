"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveTranslation } from "@/lib/admin/kvk-actions";
import { MarkdownEditor } from "./MarkdownEditor";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/**
 * One translated text next to its English source. Locked while the machine
 * translation of the row is running. Battle-plan rows save through
 * `saveTranslation` (with their plan id); the content editor passes its own action.
 */
export function TranslationForm({
  action: save = saveTranslation,
  markdown = false,
  locale,
  planId,
  table,
  id,
  column,
  lang,
  langLabel,
  label,
  english,
  value,
  pending,
  multiline = false,
  maxLength,
}: {
  action?: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  /** A Markdown text: the editor with its preview instead of a plain box. */
  markdown?: boolean;
  locale: string;
  planId?: string;
  table: string;
  id: string;
  column: string;
  lang: string;
  langLabel: string;
  label: string;
  english: string;
  value: string;
  pending: boolean;
  multiline?: boolean;
  maxLength: number;
}) {
  const [state, action] = useActionState<ActionState, FormData>(save, IDLE_STATE);
  const inputId = `tr-${table}-${id}-${column}`;
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-card-soft p-3">
      <input type="hidden" name="locale" value={locale} />
      {planId && <input type="hidden" name="planId" value={planId} />}
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="column" value={column} />
      <input type="hidden" name="lang" value={lang} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="label">{label} · English (source)</p>
          <div className="rounded-xl bg-card px-3 py-2 text-sm font-semibold wrap-break-word whitespace-pre-wrap text-ink-muted" dir="ltr">
            {english || "—"}
          </div>
        </div>
        <Field label={`${label} · ${langLabel}`} htmlFor={inputId} error={state.errors?.value}>
          {markdown ? (
            <MarkdownEditor id={inputId} name="value" defaultValue={value} disabled={pending} dir="auto" maxLength={maxLength} className="min-h-40" />
          ) : multiline ? (
            <textarea id={inputId} name="value" className="input min-h-40 font-mono text-sm" defaultValue={value} disabled={pending} dir="auto" maxLength={maxLength} />
          ) : (
            <input id={inputId} name="value" className="input" defaultValue={value} disabled={pending} dir="auto" maxLength={maxLength} />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {pending ? (
          <p className="text-sm font-bold text-ink-muted" role="status">
            ⏳ Machine translation in progress; this field unlocks by itself when it is done.
          </p>
        ) : (
          <SubmitButton>Save {langLabel}</SubmitButton>
        )}
        <Notice state={state} />
      </div>
    </form>
  );
}
