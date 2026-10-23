import clsx from "clsx";
import Image from "next/image";
import type { Hero, TroopType } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";

export const TROOP_ICONS: Record<TroopType, string> = { infantry: "🛡️", cavalry: "🐎", archers: "🏹" };

/**
 * A hero portrait as players see it in the game, with the level of the
 * top-right (expedition) skill they must have. `hero = null` draws an empty
 * slot ("any hero").
 */
export function HeroAvatar({
  hero,
  locale,
  skillLevel,
  size = "md",
  anyLabel,
  skillTitle,
}: {
  hero: Hero | null;
  locale: string;
  skillLevel: number;
  size?: "md" | "lg";
  anyLabel: string;
  skillTitle: string;
}) {
  const px = size === "lg" ? 72 : 56;
  const box = size === "lg" ? "size-18 rounded-[1.1rem]" : "size-14 rounded-2xl";

  if (!hero) {
    return (
      <figure className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
        <span className={clsx("grid place-items-center border-2 border-dashed border-line bg-card-soft text-2xl text-ink-faint", box)} aria-hidden>
          +
        </span>
        <figcaption className="w-full text-xs/tight font-bold text-ink-faint">{anyLabel}</figcaption>
      </figure>
    );
  }

  const name = pick(hero.name, locale);
  return (
    <figure className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
      <span className="relative inline-block">
        {hero.iconUrl ? (
          // Already 128px: skip the optimiser (saves free-tier image transformations).
          <Image
            src={hero.iconUrl}
            alt=""
            width={px}
            height={px}
            unoptimized
            className={clsx("border-2 border-gold bg-card-soft object-cover shadow-[0_3px_0_0_var(--gold-strong)]", box)}
          />
        ) : (
          <span className={clsx("grid place-items-center border-2 border-gold bg-primary-soft text-2xl", box)} aria-hidden>
            {TROOP_ICONS[hero.troopType]}
          </span>
        )}
        {/* The game shows the expedition skill at the top-right corner of the portrait — kept physical on purpose. */}
        <span
          className={clsx(
            "absolute -top-1.5 -right-1.5 grid place-items-center rounded-full bg-gold font-black text-gold-ink ring-2 ring-card",
            size === "lg" ? "size-7 text-xs" : "size-6 text-[11px]",
          )}
          title={`${skillTitle}: ${skillLevel}`}
        >
          {skillLevel}
        </span>
        <span className="absolute -inset-s-1 -bottom-1 grid size-5 place-items-center rounded-full bg-card text-[11px] ring-1 ring-line" aria-hidden>
          {TROOP_ICONS[hero.troopType]}
        </span>
      </span>
      <figcaption className="w-full truncate text-xs/tight font-extrabold text-ink" dir="auto" title={name}>
        {name}
      </figcaption>
    </figure>
  );
}
