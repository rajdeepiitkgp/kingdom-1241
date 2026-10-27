// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { LeaderStatus } from "./room";

/**
 * Counter-rally rooms (pure, unit-tested). The counter alliance can't see the
 * enemy's rally on the castle, only its own alliance's rallies, so the room
 * gives a launch order instead of start times: the slowest march starts first
 * when the main alliance says go, and everyone else starts when an earlier
 * counter rally's countdown (all on the room's rally timer) shows their cue,
 * so every counter rally lands in the same second:
 *
 *   cue = rally timer − (their march − my march)
 *
 * From the third leader on there are two cues, the first rally's and the one
 * just before, so a second's slip along the chain doesn't add up.
 */

export interface CounterCue {
  /** The leader whose rally countdown to watch. */
  name: string;
  /** What their countdown shows when this leader starts; 0 or less: it has already run out, so `gapSeconds` after they started. */
  seconds: number;
  gapSeconds: number;
}

export interface CounterStep<T> {
  leader: T;
  position: number;
  /** The first rally's cue; null for the first leader, who starts on the main alliance's word. */
  first: CounterCue | null;
  /** The rally just before's cue, from the third leader on (for the second it is the first). */
  previous: CounterCue | null;
}

/** The launch order: slowest march first (ties by name), leaders sitting out left out. */
export function counterOrder<T extends { name: string; marchSeconds: number; status?: LeaderStatus }>(leaders: readonly T[], rallyWaitSeconds: number): CounterStep<T>[] {
  const order = leaders.filter((l) => l.status !== "inactive").sort((a, b) => b.marchSeconds - a.marchSeconds || a.name.localeCompare(b.name));
  return order.map((leader, index) => {
    const cue = (other: T): CounterCue => {
      const gapSeconds = other.marchSeconds - leader.marchSeconds;
      return { name: other.name, seconds: rallyWaitSeconds - gapSeconds, gapSeconds };
    };
    return { leader, position: index + 1, first: index === 0 ? null : cue(order[0]), previous: index < 2 ? null : cue(order[index - 1]) };
  });
}
