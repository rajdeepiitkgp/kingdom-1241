// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Rally troop refill calculator.
 *
 * Given the rally capacity, the troops already inside the rally and the
 * target type ratio, work out how many troops of each type still have to be
 * sent. When a type is already above its target, the remaining free capacity
 * is split between the other types in proportion to how far they are below
 * target (troops already in a rally can't be taken out by the calculator).
 */

export const TROOP_TYPES = ["infantry", "cavalry", "archers"] as const;
export type TroopType = (typeof TROOP_TYPES)[number];

export type TroopCounts = Record<TroopType, number>;

export interface RefillInput {
  capacity: number;
  current: TroopCounts;
  /** Percentages, should add up to 100. */
  target: TroopCounts;
}

export interface RefillRow {
  type: TroopType;
  current: number;
  targetCount: number;
  toSend: number;
  after: number;
  afterPercent: number;
}

export interface RefillResult {
  rows: RefillRow[];
  deployed: number;
  remaining: number;
  totalToSend: number;
  /** Target percentages don't add up to 100 (±0.5). */
  invalidRatio: boolean;
  /** No free capacity left. */
  full: boolean;
  /** At least one troop type is already above its target. */
  overTarget: boolean;
}

const clamp0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export const REFILL_PRESETS: Record<string, TroopCounts> = {
  bearGen4: { infantry: 1, cavalry: 10, archers: 89 },
  bearGen1: { infantry: 10, cavalry: 30, archers: 60 },
  balanced: { infantry: 40, cavalry: 30, archers: 30 },
  infantryWall: { infantry: 60, cavalry: 20, archers: 20 },
  vikings: { infantry: 75, cavalry: 25, archers: 0 },
};

export function calculateRefill(input: RefillInput): RefillResult {
  const capacity = Math.floor(clamp0(input.capacity));
  const current: TroopCounts = {
    infantry: Math.floor(clamp0(input.current.infantry)),
    cavalry: Math.floor(clamp0(input.current.cavalry)),
    archers: Math.floor(clamp0(input.current.archers)),
  };
  const target: TroopCounts = {
    infantry: clamp0(input.target.infantry),
    cavalry: clamp0(input.target.cavalry),
    archers: clamp0(input.target.archers),
  };

  const ratioSum = target.infantry + target.cavalry + target.archers;
  const invalidRatio = Math.abs(ratioSum - 100) > 0.5;

  const deployed = current.infantry + current.cavalry + current.archers;
  const remaining = Math.max(0, capacity - deployed);

  // Target counts, rounded so they add up to the capacity exactly.
  const raw = TROOP_TYPES.map((t) => (ratioSum > 0 ? (capacity * target[t]) / ratioSum : 0));
  const targetCounts = largestRemainderRound(raw, capacity);

  const deficits = TROOP_TYPES.map((t, i) => Math.max(0, targetCounts[i] - current[t]));
  const sumDeficit = deficits.reduce((a, b) => a + b, 0);
  const overTarget = TROOP_TYPES.some((t, i) => current[t] > targetCounts[i]);

  let toSend: number[];
  if (remaining === 0 || sumDeficit === 0) {
    toSend = [0, 0, 0];
  } else if (sumDeficit <= remaining) {
    toSend = deficits;
  } else {
    // Not enough room to fix every deficit: fill proportionally.
    toSend = largestRemainderRound(
      deficits.map((d) => (d * remaining) / sumDeficit),
      remaining,
    );
  }

  const afterTotal = deployed + toSend.reduce((a, b) => a + b, 0);
  const rows: RefillRow[] = TROOP_TYPES.map((type, i) => {
    const after = current[type] + toSend[i];
    return {
      type,
      current: current[type],
      targetCount: targetCounts[i],
      toSend: toSend[i],
      after,
      afterPercent: afterTotal > 0 ? (after / afterTotal) * 100 : 0,
    };
  });

  return {
    rows,
    deployed,
    remaining,
    totalToSend: toSend.reduce((a, b) => a + b, 0),
    invalidRatio,
    full: capacity > 0 && remaining === 0,
    overTarget,
  };
}

/** Round a list of non-negative numbers to integers that sum exactly to `total`. */
export function largestRemainderRound(values: number[], total: number): number[] {
  const floors = values.map((v) => Math.floor(clamp0(v)));
  let leftover = Math.max(0, Math.round(total) - floors.reduce((a, b) => a + b, 0));
  const order = values
    .map((v, i) => ({ i, frac: clamp0(v) - Math.floor(clamp0(v)) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (leftover <= 0) break;
    if (values[i] <= 0) continue;
    floors[i] += 1;
    leftover -= 1;
  }
  // If every value was 0 but total > 0 (degenerate), give it to the first slot.
  if (leftover > 0 && floors.length > 0) floors[0] += leftover;
  return floors;
}
