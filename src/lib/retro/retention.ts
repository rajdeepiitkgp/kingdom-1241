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

/** Why a form can't be opened now, or null: its answers would already be due for deletion at the next daily clean-up. */
export function openAfterRetentionProblem(r: RetentionInput, now: Date): string | null {
  return isDue(r, now)
    ? `The retention period (${r.retentionDays} days from the battle) has passed: answers would be deleted at the next daily clean-up. Raise the retention days to open the form.`
    : null;
}

/** Open, and not past its optional closing time. */
export function isOpenNow(r: { open: boolean; closesAt: string | null }, now: Date): boolean {
  if (!r.open) return false;
  if (!r.closesAt) return true;
  const closes = Date.parse(r.closesAt);
  return Number.isNaN(closes) || closes > now.getTime();
}
