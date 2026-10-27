"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveChecklistItem } from "@/lib/admin/kvk-actions";
import type { KvkChecklistItem } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/** One task on the commander checklist: when it is due, what to do and an optional note. */
export function ChecklistItemForm({ locale, planId, item }: { locale: string; planId: string; item: KvkChecklistItem | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveChecklistItem, IDLE_STATE);
  const prefix = item ? `citem-${item.id}` : "citem-new";
  return (
    <form action={action} className="grid min-w-0 grow basis-72 grid-cols-1 gap-2 md:grid-cols-[12rem_1fr_auto_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="When" htmlFor={`${prefix}-phase`}>
        <select id={`${prefix}-phase`} name="phase" className="input select-chevron" defaultValue={item?.phase ?? "before"}>
          <option value="before">Before battle day</option>
          <option value="day">Battle day, before the start</option>
          <option value="during">During the battle</option>
          <option value="after">After the battle</option>
        </select>
      </Field>
      <Field label="Task (English)" htmlFor={`${prefix}-text`} error={state.errors?.text}>
        <input
          id={`${prefix}-text`}
          name="text"
          className="input"
          defaultValue={pick(item?.text, "en")}
          required
          maxLength={400}
          placeholder="e.g. Check that every rally leader is online"
        />
      </Field>
      <label className="flex items-center gap-2 pb-3 text-sm font-bold text-ink">
        <input type="checkbox" name="published" defaultChecked={item?.published ?? true} className="size-4" />
        Shown
      </label>
      <div className="pb-1">
        <SubmitButton>{item ? "Save" : "Add"}</SubmitButton>
      </div>
      <Field label="Note (optional): who, where or how" htmlFor={`${prefix}-note`} error={state.errors?.note} className="md:col-start-2">
        <input id={`${prefix}-note`} name="note" className="input" defaultValue={pick(item?.note, "en")} maxLength={200} />
      </Field>
      <Notice state={state} className="md:col-span-full" />
    </form>
  );
}
