"use client";

import { useActionState, useState } from "react";
import { HeroAvatar, TROOP_ICONS } from "@/components/kvk/HeroAvatar";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveFormation } from "@/lib/admin/kvk-actions";
import { FORMATION_LABELS } from "@/lib/admin/kvk-forms";
import type { FormationSide, Hero, KvkFormation, TroopType } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

const TROOPS: TroopType[] = ["infantry", "cavalry", "archers"];
type Slots = [string | null, string | null, string | null];

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
  const [slots, setSlots] = useState<Slots>(formation?.heroSlugs ?? [null, null, null]);
  // Attackers rally, defenders garrison: the role words follow the side.
  const [side, setSide] = useState<FormationSide>(formation?.side ?? "any");
  const roleWord = side === "attack" ? "Rally" : side === "defense" ? "Garrison" : "Rally or garrison";
  const [ratio, setRatio] = useState<Record<TroopType, number>>({
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
  // The preset letter of the "add" form follows the list: after an add the next
  // free letter arrives as a new prop.
  const [label, setLabel] = useState(formation?.label ?? defaultLabel);
  const [seenLabel, setSeenLabel] = useState(defaultLabel);
  if (!formation && defaultLabel !== seenLabel) {
    setSeenLabel(defaultLabel);
    setLabel(defaultLabel);
  }
  const sum = ratio.infantry + ratio.cavalry + ratio.archers;
  const prefix = formation ? `formation-${formation.id}` : "formation-new";
  const errors = state.errors ?? {};
  const heroBySlug = new Map(heroes.map((h) => [h.slug, h]));
  const byTroop = TROOPS.map((type) => ({ type, heroes: heroes.filter((h) => h.troopType === type) }));
  const setSlot = (index: number, slug: string | null) => setSlots(slots.map((s, i) => (i === index ? slug : s)) as Slots);

  return (
    <form action={action} className="min-w-0 flex-1 space-y-4">
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

      {/* The portraits follow the dropdowns, so admins see what players will see. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {slots.map((slug, index) => (
          <div key={index} className="flex items-end gap-3 rounded-2xl bg-card p-2 pe-3">
            <HeroAvatar
              hero={slug ? (heroBySlug.get(slug) ?? null) : null}
              locale="en"
              skillLevel={skillLevel}
              anyLabel="Any hero"
              skillTitle="Top expedition skill level"
            />
            <Field className="flex-1" label={`Hero ${index + 1}`} htmlFor={`${prefix}-hero${index + 1}`} error={errors[`hero${index + 1}`]}>
              <select
                id={`${prefix}-hero${index + 1}`}
                name={`hero${index + 1}`}
                className="input select-chevron"
                value={slug ?? ""}
                onChange={(event) => setSlot(index, event.target.value || null)}
              >
                <option value="">Any hero</option>
                {byTroop.map((group) => (
                  <optgroup key={group.type} label={`${TROOP_ICONS[group.type]} ${group.type}`}>
                    {group.heroes.map((hero) => (
                      <option key={hero.slug} value={hero.slug}>
                        {pick(hero.name, "en")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
        ))}
      </div>
      {errors.heroes && <p className="text-xs font-bold text-danger">{errors.heroes}</p>}

      <div className="grid grid-cols-3 gap-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        {TROOPS.map((type) => (
          <Field key={type} label={`${TROOP_ICONS[type]} ${type} %`} htmlFor={`${prefix}-${type}`}>
            <input
              id={`${prefix}-${type}`}
              name={type}
              type="number"
              min={0}
              max={100}
              className="input"
              value={ratio[type]}
              onChange={(event) => setRatio({ ...ratio, [type]: Number(event.target.value) || 0 })}
              required
            />
          </Field>
        ))}
        <p className={`pb-3 text-sm font-bold ${sum === 100 ? "text-success" : "text-danger"}`} aria-live="polite">
          = {sum}% {sum === 100 ? "✓" : "(must be 100)"}
        </p>
      </div>
      {errors.ratio && <p className="text-xs font-bold text-danger">{errors.ratio}</p>}

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
