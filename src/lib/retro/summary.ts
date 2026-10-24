import { RATING_MAX, RATING_MIN, type RatingKey } from "./questions";

/** Numbers for the admin results page (pure, unit-tested). */

export interface RatingSummary {
  key: RatingKey;
  /** Responses that answered this question. */
  count: number;
  /** Mean of the answers, or null without any. */
  average: number | null;
  /** How many answered 0, 1, …, 5 (index = value). */
  distribution: number[];
}

type Rated = { ratings: Partial<Record<RatingKey, number>> };

export function averageOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function answers(responses: readonly Rated[], key: RatingKey): number[] {
  const out: number[] = [];
  for (const r of responses) {
    const v = r.ratings[key];
    if (typeof v === "number" && Number.isInteger(v) && v >= RATING_MIN && v <= RATING_MAX) out.push(v);
  }
  return out;
}

export function summarizeRatings(responses: readonly Rated[], keys: readonly RatingKey[]): RatingSummary[] {
  return keys.map((key) => {
    const values = answers(responses, key);
    const distribution = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, () => 0);
    for (const v of values) distribution[v - RATING_MIN] += 1;
    return { key, count: values.length, average: averageOf(values), distribution };
  });
}

/** Mean of the question averages (questions nobody answered are left out), or null. */
export function overallAverage(summaries: readonly RatingSummary[]): number | null {
  return averageOf(summaries.map((s) => s.average).filter((a): a is number => a !== null));
}

export interface AllianceSummary {
  /** null = other / no alliance. */
  tag: string | null;
  count: number;
  averages: Partial<Record<RatingKey, number | null>>;
}

/** Averages per alliance, biggest group first. */
export function summarizeByAlliance(responses: ReadonlyArray<Rated & { allianceTag: string | null }>, keys: readonly RatingKey[]): AllianceSummary[] {
  const groups = new Map<string | null, Array<Rated & { allianceTag: string | null }>>();
  for (const r of responses) {
    const list = groups.get(r.allianceTag) ?? [];
    list.push(r);
    groups.set(r.allianceTag, list);
  }
  return [...groups.entries()]
    .map(([tag, rows]) => ({
      tag,
      count: rows.length,
      averages: Object.fromEntries(keys.map((key) => [key, averageOf(answers(rows, key))])) as Partial<Record<RatingKey, number | null>>,
    }))
    .sort((a, b) => b.count - a.count || String(a.tag ?? "~").localeCompare(String(b.tag ?? "~")));
}

/** "4.2" style label, or an em dash without data. */
export function formatAverage(value: number | null): string {
  return value === null ? "—" : (Math.round(value * 10) / 10).toFixed(1);
}

/** Share of a distribution bucket in percent (0 when nothing was answered). */
export function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 100);
}
