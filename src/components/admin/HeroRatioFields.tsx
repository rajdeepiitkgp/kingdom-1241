"use client";

import { HeroAvatar, TROOP_ICONS } from "@/components/kvk/HeroAvatar";
import type { Hero, TroopType } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";
import { Field } from "./ui";

/** Shared by the formation and rally-leader forms: three hero slots and a troop ratio (controlled by the form). */

const TROOPS: TroopType[] = ["infantry", "cavalry", "archers"];
export type HeroSlots = [string | null, string | null, string | null];
export type Ratio = Record<TroopType, number>;

/** Three hero dropdowns; the portraits follow them, so admins see what players will see. */
export function HeroSlotFields({
  prefix,
  slots,
  onChange,
  heroes,
  skillLevel,
  errors,
  anyLabel = "Any hero",
}: {
  prefix: string;
  slots: HeroSlots;
  onChange: (slots: HeroSlots) => void;
  heroes: Hero[];
  /** Required top-right skill level, shown on the portraits. */
  skillLevel: number;
  errors: Record<string, string>;
  anyLabel?: string;
}) {
  const heroBySlug = new Map(heroes.map((h) => [h.slug, h]));
  const byTroop = TROOPS.map((type) => ({ type, heroes: heroes.filter((h) => h.troopType === type) }));
  const setSlot = (index: number, slug: string | null) => onChange(slots.map((s, i) => (i === index ? slug : s)) as HeroSlots);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {slots.map((slug, index) => (
          <div key={index} className="flex items-end gap-3 rounded-2xl bg-card p-2 pe-3">
            <HeroAvatar
              hero={slug ? (heroBySlug.get(slug) ?? null) : null}
              locale="en"
              skillLevel={skillLevel}
              anyLabel={anyLabel}
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
                <option value="">{anyLabel}</option>
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
    </>
  );
}

/** Infantry / cavalry / archers in percent with a live sum. */
export function RatioFields({ prefix, ratio, onChange, error }: { prefix: string; ratio: Ratio; onChange: (ratio: Ratio) => void; error?: string }) {
  const sum = ratio.infantry + ratio.cavalry + ratio.archers;
  return (
    <>
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
              onChange={(event) => onChange({ ...ratio, [type]: Number(event.target.value) || 0 })}
              required
            />
          </Field>
        ))}
        <p className={`pb-3 text-sm font-bold ${sum === 100 ? "text-success" : "text-danger"}`} aria-live="polite">
          = {sum}% {sum === 100 ? "✓" : "(must be 100)"}
        </p>
      </div>
      {error && <p className="text-xs font-bold text-danger">{error}</p>}
    </>
  );
}
