import clsx from "clsx";
import type { TroopType } from "@/lib/data/types";
import { TROOP_ORDER } from "@/lib/kvk/formations";
import { TROOP_ICONS } from "./HeroAvatar";

const BAR_COLORS: Record<TroopType, string> = {
  infantry: "bg-sky-400",
  cavalry: "bg-amber-400",
  archers: "bg-emerald-400",
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
              "flex min-w-0 items-center gap-1.5 rounded-xl bg-card-soft px-2 py-1.5 text-xs",
              ratio[type] === 0 && "opacity-50",
            )}
          >
            <span className={clsx("size-2.5 shrink-0 rounded-full", BAR_COLORS[type])} aria-hidden />
            <span className="shrink-0" aria-hidden>
              {TROOP_ICONS[type]}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold text-ink-muted">{labels[type]}</span>
            <span className="shrink-0 font-black text-ink tabular" dir="ltr">
              {ratio[type]}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
