"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveChecklistRule } from "@/lib/admin/kvk-actions";
import type { KvkChecklistRule } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/** One line on the checklist page: an order for the battle commander or a general guideline. */
export function ChecklistRuleForm({ locale, planId, rule }: { locale: string; planId: string; rule: KvkChecklistRule | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveChecklistRule, IDLE_STATE);
  const prefix = rule ? `crule-${rule.id}` : "crule-new";
  return (
    <form action={action} className="grid min-w-0 grow basis-72 grid-cols-1 gap-2 md:grid-cols-[11rem_7rem_1fr_auto_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <Field label="Section" htmlFor={`${prefix}-section`}>
        <select id={`${prefix}-section`} name="section" className="input select-chevron" defaultValue={rule?.section ?? "commander"}>
          <option value="commander">🎖️ Commander&apos;s orders</option>
          <option value="general">📌 General guideline</option>
        </select>
      </Field>
      <Field label="Kind" htmlFor={`${prefix}-kind`}>
        <select id={`${prefix}-kind`} name="kind" className="input select-chevron" defaultValue={rule?.kind ?? "do"}>
          <option value="do">✅ Do</option>
          <option value="dont">⛔ Don&apos;t</option>
          <option value="info">ℹ️ Info</option>
        </select>
      </Field>
      <Field label="Line (English)" htmlFor={`${prefix}-text`} error={state.errors?.text}>
        <input
          id={`${prefix}-text`}
          name="text"
          className="input"
          defaultValue={pick(rule?.text, "en")}
          required
          maxLength={400}
          placeholder="e.g. Only the commander calls when a rally starts"
        />
      </Field>
      <label className="flex items-center gap-2 pb-3 text-sm font-bold text-ink">
        <input type="checkbox" name="published" defaultChecked={rule?.published ?? true} className="size-4" />
        Shown
      </label>
      <div className="pb-1">
        <SubmitButton>{rule ? "Save" : "Add"}</SubmitButton>
      </div>
      <Notice state={state} className="md:col-span-full" />
    </form>
  );
}
