"use client";

import { useActionState, useState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveFormation } from "@/lib/admin/kvk-actions";
import { FORMATION_LABELS } from "@/lib/admin/kvk-forms";
import type { FormationSide, Hero, KvkFormation } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { HeroSlotFields, type HeroSlots, RatioFields, type Ratio } from "./HeroRatioFields";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useSubmitInTransition } from "./useEditorForm";

export function FormationForm({
  locale,
  planId,
  formation,
  heroes,
  skillLevel,
  defaultLabel,
}: {
  locale: string;
  planId: string;
  formation: KvkFormation | null;
  heroes: Hero[];
  /** Required top-right skill level, shown on the portraits. */
  skillLevel: number;
  defaultLabel: string;
}) {
  const [slots, setSlots] = useState<HeroSlots>(formation?.heroSlugs ?? [null, null, null]);
  // Attackers rally, defenders garrison: the role words follow the side.
  const [side, setSide] = useState<FormationSide>(formation?.side ?? "any");
  const roleWord = side === "attack" ? "Rally" : side === "defense" ? "Garrison" : "Rally or garrison";
  const [ratio, setRatio] = useState<Ratio>({
    infantry: formation?.infantry ?? 50,
    cavalry: formation?.cavalry ?? 0,
    archers: formation?.archers ?? 50,
  });
  // The "add" form clears its controlled fields after a successful add (React
  // resets the uncontrolled ones by itself) and keeps the success notice.
  const [state, action] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await saveFormation(previous, formData);
    if (!formation && result.status === "saved") {
      setSlots([null, null, null]);
      setSide("any");
      setRatio({ infantry: 50, cavalry: 0, archers: 50 });
    }
    return result;
  }, IDLE_STATE);
  // Editing keeps what was saved on screen; the add form keeps React's reset, so it clears after an add.
  const submit = useSubmitInTransition(action);
  // The preset letter of the "add" form follows the list: after an add the next
  // free letter arrives as a new prop.
  const [label, setLabel] = useState(formation?.label ?? defaultLabel);
  const [seenLabel, setSeenLabel] = useState(defaultLabel);
  if (!formation && defaultLabel !== seenLabel) {
    setSeenLabel(defaultLabel);
    setLabel(defaultLabel);
  }
  const prefix = formation ? `formation-${formation.id}` : "formation-new";
  const errors = state.errors ?? {};

  return (
    <form action={action} onSubmit={formation ? submit : undefined} className="min-w-0 flex-1 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      {formation && <input type="hidden" name="id" value={formation.id} />}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-[5rem_1fr_1fr_auto]">
        <Field label="Preset" htmlFor={`${prefix}-label`} error={errors.label}>
          <select id={`${prefix}-label`} name="label" className="input select-chevron" value={label} onChange={(event) => setLabel(event.target.value)}>
            {FORMATION_LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Side" htmlFor={`${prefix}-side`}>
          <select id={`${prefix}-side`} name="side" className="input select-chevron" value={side} onChange={(event) => setSide(event.target.value as FormationSide)}>
            <option value="attack">⚔️ Attack</option>
            <option value="defense">🛡️ Defence</option>
            <option value="any">Either</option>
          </select>
        </Field>
        <Field label="Role" htmlFor={`${prefix}-role`}>
          <select id={`${prefix}-role`} name="role" className="input select-chevron" defaultValue={formation?.role ?? "any"}>
            <option value="rally_lead">{roleWord} leader</option>
            <option value="rally_join">{roleWord} joiner</option>
            <option value="any">Either</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-ink">
          <input type="checkbox" name="published" defaultChecked={formation?.published ?? true} className="size-4" />
          Shown
        </label>
      </div>

      <HeroSlotFields prefix={prefix} slots={slots} onChange={setSlots} heroes={heroes} skillLevel={skillLevel} errors={errors} />
      <RatioFields prefix={prefix} ratio={ratio} onChange={setRatio} error={errors.ratio} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Note (English)" htmlFor={`${prefix}-note`}>
          <input
            id={`${prefix}-note`}
            name="note"
            className="input"
            defaultValue={pick(formation?.note, "en")}
            maxLength={200}
            placeholder="optional, e.g. use for the first rally only"
          />
        </Field>
        <div className="pb-1">
          <SubmitButton>{formation ? "Save formation" : "Add formation"}</SubmitButton>
        </div>
      </div>
      <Notice state={state} />
    </form>
  );
}
