import type { RatingKey } from "@/lib/retro/questions";
import { type AllianceSummary, formatAverage } from "@/lib/retro/summary";

/** Average of every shown rating per home alliance (feedback results and their print view). */
export function AllianceTable({ groups, keys, labelOf }: { groups: AllianceSummary[]; keys: RatingKey[]; labelOf: (key: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-ink-faint">
            <th className="py-1 text-start font-bold">Alliance</th>
            <th className="py-1 text-end font-bold">Responses</th>
            {keys.map((key) => (
              <th key={key} className="py-1 text-end font-bold" title={labelOf(key)}>
                {key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.tag ?? "-"} className="border-t border-line">
              <td className="py-1.5 font-bold text-ink">{group.tag ? `[${group.tag}]` : "Other / none"}</td>
              <td className="py-1.5 text-end tabular">{group.count}</td>
              {keys.map((key) => (
                <td key={key} className="py-1.5 text-end tabular">
                  {formatAverage(group.averages[key] ?? null)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
