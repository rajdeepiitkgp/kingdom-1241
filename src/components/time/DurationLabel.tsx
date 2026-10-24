import type { Dictionary } from "@/lib/i18n/dictionary";
import { pad2, splitDuration } from "@/lib/time";

/**
 * "2d 05h 13m" style label, or "00:12:34" when `clock` is set.
 */
export function formatDuration(ms: number, dict: Dictionary, clock = false): string {
  const d = splitDuration(ms);
  if (clock) {
    if (d.days > 0) return `${d.days}${dict["common.daysShort"]} ${pad2(d.hours)}:${pad2(d.minutes)}:${pad2(d.seconds)}`;
    return `${pad2(d.hours)}:${pad2(d.minutes)}:${pad2(d.seconds)}`;
  }
  const parts: string[] = [];
  if (d.days > 0) parts.push(`${d.days} ${dict["common.days"]}`);
  if (d.days > 0 || d.hours > 0) parts.push(`${d.hours} ${dict["common.hours"]}`);
  parts.push(`${d.minutes} ${dict["common.minutes"]}`);
  if (d.days === 0) parts.push(`${pad2(d.seconds)} ${dict["common.seconds"]}`);
  return parts.join(" ");
}

export function DurationUnits({ ms, dict }: { ms: number; dict: Dictionary }) {
  const d = splitDuration(ms);
  const units: Array<[number, string]> = [];
  if (d.days > 0) units.push([d.days, dict["common.days"]]);
  units.push([d.hours, dict["common.hours"]]);
  units.push([d.minutes, dict["common.minutes"]]);
  if (d.days === 0) units.push([d.seconds, dict["common.seconds"]]);

  return (
    <span className="inline-flex items-baseline gap-2 tabular" dir="ltr">
      {units.map(([value, label], index) => (
        <span key={index} className="inline-flex items-baseline gap-0.5">
          <span className="text-2xl leading-none font-black">{pad2(value)}</span>
          <span className="text-xs font-bold text-ink-muted">{label}</span>
        </span>
      ))}
    </span>
  );
}
