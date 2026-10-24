"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveRule } from "@/lib/admin/kvk-actions";
import type { KvkRule } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

export function RuleForm({ locale, planId, rule }: { locale: string; planId: string; rule: KvkRule | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveRule, IDLE_STATE);
  const prefix = rule ? `rule-${rule.id}` : "rule-new";
  return (
    <form action={action} className="grid min-w-0 grow basis-72 grid-cols-1 gap-2 md:grid-cols-[7rem_1fr_auto_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      {rule && <input type="hidden" name="id" value={rule.id} />}
      <Field label="Kind" htmlFor={`${prefix}-kind`}>
        <select id={`${prefix}-kind`} name="kind" className="input select-chevron" defaultValue={rule?.kind ?? "info"}>
          <option value="do">✅ Do</option>
          <option value="dont">⛔ Don&apos;t</option>
          <option value="info">ℹ️ Info</option>
        </select>
      </Field>
      <Field label="Instruction (English)" htmlFor={`${prefix}-text`} error={state.errors?.text}>
        <input id={`${prefix}-text`} name="text" className="input" defaultValue={pick(rule?.text, "en")} required maxLength={400} />
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
