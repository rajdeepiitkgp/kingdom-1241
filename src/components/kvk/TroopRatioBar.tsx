import clsx from "clsx";
import type { TroopType } from "@/lib/data/types";
import { TROOP_ORDER } from "@/lib/kvk/formations";
import { TROOP_ICONS } from "./HeroAvatar";

const BAR_COLORS: Record<TroopType, string> = {
  infantry: "bg-sky-400",
  cavalry: "bg-amber-400",
  archers: "bg-emerald-400",
};

/** Legend pills tinted with their troop colour so they stand out from the card in both themes. */
const PILL_COLORS: Record<TroopType, string> = {
  infantry: "bg-sky-400/15 ring-sky-400/50 dark:bg-sky-400/20",
  cavalry: "bg-amber-400/15 ring-amber-400/50 dark:bg-amber-400/20",
  archers: "bg-emerald-400/15 ring-emerald-400/50 dark:bg-emerald-400/20",
};

/**
 * Infantry / cavalry / archers split as a bar plus a legend. Each legend entry
 * is its own pill so a percentage can never be read as part of the next entry.
 */
export function TroopRatioBar({ ratio, labels }: { ratio: Record<TroopType, number>; labels: Record<TroopType, string> }) {
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-card-soft ring-1 ring-line" dir="ltr" aria-hidden>
        {TROOP_ORDER.filter((type) => ratio[type] > 0).map((type) => (
          <div key={type} className={BAR_COLORS[type]} style={{ width: `${ratio[type]}%` }} />
        ))}
      </div>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {TROOP_ORDER.map((type) => (
          <li
            key={type}
            className={clsx(
              "flex min-w-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs ring-1",
              PILL_COLORS[type],
              ratio[type] === 0 && "opacity-60",
            )}
          >
            {/* Icon on a neutral disc: the brown horse emoji disappears on the amber tint otherwise. */}
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-[0.6875rem] ring-1 ring-line" aria-hidden>
              {TROOP_ICONS[type]}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold text-ink">{labels[type]}</span>
            <span className="shrink-0 font-black text-ink tabular" dir="ltr">
              {ratio[type]}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
