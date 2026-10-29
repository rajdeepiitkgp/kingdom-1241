"use client";

import { useActionState, useState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveRallyLeader } from "@/lib/admin/kvk-actions";
import type { Alliance, Hero, KvkRallyLeader } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { toUtcInputValue } from "@/lib/admin/forms";
import { DateTimeField } from "./DateTimeField";
import { HeroSlotFields, type HeroSlots, type Ratio, RatioFields } from "./HeroRatioFields";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useSubmitInTransition } from "./useEditorForm";

const EMPTY_SLOTS: HeroSlots = [null, null, null];
const DEFAULT_RATIO: Ratio = { infantry: 50, cavalry: 0, archers: 50 };
/** Pet timings are offered in 15-minute steps, up to the latest start whose 2-hour boost ends inside the battle. */
const PET_STEP = 15;

function offsetText(minutes: number): string {
  if (minutes === 0) return "At the battle start";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h ? `${h} h` : ""}${h && m ? " " : ""}${m ? `${m} min` : ""} after the start`;
}

/** One rally on the leader page: which rally, who leads it, their own heroes and the troop ratio. */
export function RallyLeaderForm({
  locale,
  planId,
  rally,
  heroes,
  alliances,
  skillLevel,
  latestPetsOffset,
}: {
  locale: string;
  planId: string;
  rally: KvkRallyLeader | null;
  heroes: Hero[];
  alliances: Pick<Alliance, "tag" | "name">[];
  skillLevel: number;
  /** Minutes after the battle start; later starts would run the boost past the battle end. */
  latestPetsOffset: number;
}) {
  const petOffsets = Array.from({ length: Math.floor(latestPetsOffset / PET_STEP) + 1 }, (_, i) => i * PET_STEP);
  const [slots, setSlots] = useState<HeroSlots>(rally?.heroSlugs ?? EMPTY_SLOTS);
  const [ratio, setRatio] = useState<Ratio>(rally ? { infantry: rally.infantry, cavalry: rally.cavalry, archers: rally.archers } : DEFAULT_RATIO);
  // The "add" form clears its controlled fields after a successful add (React resets the uncontrolled ones).
  const [state, action] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await saveRallyLeader(previous, formData);
    if (!rally && result.status === "saved") {
      setSlots(EMPTY_SLOTS);
      setRatio(DEFAULT_RATIO);
    }
    return result;
  }, IDLE_STATE);
  // Editing keeps what was saved on screen; the add form keeps React's reset, so it clears after an add.
  const submit = useSubmitInTransition(action);
  const prefix = rally ? `rally-${rally.id}` : "rally-new";
  const errors = state.errors ?? {};

  return (
    <form action={action} onSubmit={rally ? submit : undefined} className="min-w-0 flex-1 space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      {rally && <input type="hidden" name="id" value={rally.id} />}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_11rem_10rem_auto]">
        <Field label="Rally (English)" htmlFor={`${prefix}-target`} error={errors.target}>
          <input
            id={`${prefix}-target`}
            name="target"
            className="input"
            defaultValue={pick(rally?.target, "en")}
            required
            maxLength={120}
            placeholder="e.g. Castle — first wave"
          />
        </Field>
        <Field label="Side" htmlFor={`${prefix}-side`}>
          <select id={`${prefix}-side`} name="side" className="input select-chevron" defaultValue={rally?.side ?? "attack"}>
            <option value="attack">⚔️ Rally (attack)</option>
            <option value="defense">🛡️ Garrison (defence)</option>
            <option value="any">Either</option>
          </select>
        </Field>
        <Field label="Battle team" htmlFor={`${prefix}-team`}>
          <select id={`${prefix}-team`} name="team" className="input select-chevron" defaultValue={rally?.team ?? "kvk"}>
            <option value="kvk">[KvK] rally</option>
            <option value="tmp">[TMP] counter</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold text-ink">
          <input type="checkbox" name="published" defaultChecked={rally?.published ?? true} className="size-4" />
          Shown
        </label>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Field label="Leader's in-game name" htmlFor={`${prefix}-name`} error={errors.name}>
          <input id={`${prefix}-name`} name="name" className="input" defaultValue={rally?.name ?? ""} required maxLength={60} />
        </Field>
        <Field label="Home alliance" htmlFor={`${prefix}-alliance`} error={errors.allianceTag} hint="Their own alliance (EOL, ULU, …); the battle team is above.">
          <select id={`${prefix}-alliance`} name="allianceTag" className="input select-chevron" defaultValue={rally?.allianceTag ?? ""}>
            <option value="">—</option>
            {alliances.map((a) => (
              <option key={a.tag} value={a.tag}>
                [{a.tag}] {a.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Position (English)" htmlFor={`${prefix}-position`} error={errors.position} hint="Where to teleport or stand.">
        <input
          id={`${prefix}-position`}
          name="position"
          className="input"
          defaultValue={pick(rally?.position, "en")}
          maxLength={120}
          placeholder="e.g. In front of the castle, left side"
        />
      </Field>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <DateTimeField
          id={`${prefix}-startAt`}
          name="startAt"
          label="Start the rally at (UTC)"
          defaultValue={toUtcInputValue(rally?.startAt)}
          hint="Optional. Leaders see it in UTC and in their own time zone; empty means “when your coordinator calls it”."
          error={errors.startAt}
          allowPast
        />
        <Field label="Activate pets" htmlFor={`${prefix}-pets`} error={errors.petsOffsetMinutes} hint="Pets boost for 2 hours from activation; the list stops where the boost would outlast the battle. Leaders see the clock times.">
          <select id={`${prefix}-pets`} name="petsOffsetMinutes" className="input select-chevron" defaultValue={rally?.petsOffsetMinutes ?? ""}>
            <option value="">No pets for this leader</option>
            {[...new Set([...petOffsets, ...(rally?.petsOffsetMinutes != null ? [rally.petsOffsetMinutes] : [])])]
              .sort((a, b) => a - b)
              .map((minutes) => (
                <option key={minutes} value={minutes}>
                  {offsetText(minutes)}
                </option>
              ))}
          </select>
        </Field>
      </div>

      <HeroSlotFields
        prefix={prefix}
        slots={slots}
        onChange={setSlots}
        heroes={heroes}
        skillLevel={skillLevel}
        errors={errors}
        anyLabel="Leader's choice"
      />
      <RatioFields prefix={prefix} ratio={ratio} onChange={setRatio} error={errors.ratio} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Note (English)" htmlFor={`${prefix}-note`}>
          <input
            id={`${prefix}-note`}
            name="note"
            className="input"
            defaultValue={pick(rally?.note, "en")}
            maxLength={200}
            placeholder="optional, e.g. start when the coordinator calls wave 1"
          />
        </Field>
        <div className="pb-1">
          <SubmitButton>{rally ? "Save rally" : "Add rally"}</SubmitButton>
        </div>
      </div>
      <Notice state={state} />
    </form>
  );
}
