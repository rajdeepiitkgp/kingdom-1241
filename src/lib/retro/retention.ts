import { DAY } from "@/lib/time";

/**
 * When a feedback form accepts answers and when its answers are deleted
 * (pure, unit-tested). Retention counts from the battle itself, so a form
 * opened late still forgets its data on time; a plan without a battle date
 * counts from the moment the retrospective was created.
 */

export interface RetentionInput {
  battleAt: string | null;
  createdAt: string;
  retentionDays: number;
}

export function pruneAt(r: RetentionInput): Date {
  const base = (r.battleAt && Date.parse(r.battleAt)) || Date.parse(r.createdAt) || 0;
  return new Date(base + r.retentionDays * DAY);
}

export function isDue(r: RetentionInput, now: Date): boolean {
  return pruneAt(r).getTime() <= now.getTime();
}

/** Open, and not past its optional closing time. */
export function isOpenNow(r: { open: boolean; closesAt: string | null }, now: Date): boolean {
  if (!r.open) return false;
  if (!r.closesAt) return true;
  const closes = Date.parse(r.closesAt);
  return Number.isNaN(closes) || closes > now.getTime();
}
