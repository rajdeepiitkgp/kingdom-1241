"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveCoordinator } from "@/lib/admin/kvk-actions";
import type { Alliance, KvkCoordinator } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";

export function CoordinatorForm({
  locale,
  planId,
  coordinator,
  alliances,
}: {
  locale: string;
  planId: string;
  coordinator: KvkCoordinator | null;
  alliances: Pick<Alliance, "tag" | "name">[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveCoordinator, IDLE_STATE);
  // Editing keeps what was saved on screen; the add form keeps React's reset, so it clears after an add.
  const submit = useSubmitInTransition(action);
  const prefix = coordinator ? `coord-${coordinator.id}` : "coord-new";
  const errors = state.errors ?? {};
  return (
    <form action={action} onSubmit={coordinator ? submit : undefined} className="grid min-w-0 grow basis-72 grid-cols-1 gap-2 md:grid-cols-[10rem_1fr_10rem_1fr_auto_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      {coordinator && <input type="hidden" name="id" value={coordinator.id} />}
      <Field label="Team" htmlFor={`${prefix}-team`}>
        <select id={`${prefix}-team`} name="team" className="input select-chevron" defaultValue={coordinator?.team ?? "kvk"}>
          <option value="kvk">[KvK] rally</option>
          <option value="tmp">[TMP] counter</option>
        </select>
      </Field>
      <Field label="In-game name" htmlFor={`${prefix}-name`} error={errors.name}>
        <input id={`${prefix}-name`} name="name" className="input" defaultValue={coordinator?.name ?? ""} required maxLength={60} />
      </Field>
      <Field label="Home alliance" htmlFor={`${prefix}-alliance`} error={errors.allianceTag}>
        <select id={`${prefix}-alliance`} name="allianceTag" className="input select-chevron" defaultValue={coordinator?.allianceTag ?? ""}>
          <option value="">—</option>
          {alliances.map((a) => (
            <option key={a.tag} value={a.tag}>
              [{a.tag}] {a.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (English)" htmlFor={`${prefix}-note`}>
        <input id={`${prefix}-note`} name="note" className="input" defaultValue={pick(coordinator?.note, "en")} maxLength={200} placeholder="e.g. languages spoken" />
      </Field>
      <label className="flex items-center gap-2 pb-3 text-sm font-bold text-ink">
        <input type="checkbox" name="published" defaultChecked={coordinator?.published ?? true} className="size-4" />
        Shown
      </label>
      <div className="pb-1">
        <SubmitButton>{coordinator ? "Save" : "Add"}</SubmitButton>
      </div>
      <Notice state={state} className="md:col-span-full" />
    </form>
  );
}
