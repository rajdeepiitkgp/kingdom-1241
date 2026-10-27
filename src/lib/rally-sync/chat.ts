// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { formatUtcClock } from "@/lib/time";
import type { CounterCue, CounterStep } from "./counter";
import { chatSummary, type EnemyRally } from "./garrison";
import { formatSeconds, isTooLate } from "./timing";

/**
 * What the coordinator pastes into the game chat for players without the page
 * (pure, unit-tested). The game chat is narrow, so every time sits on its own
 * line, with a blank line between the parts. Times are game-clock times, shown
 * as stored; `clockLabel` says "UTC" or "game clock".
 */

const clock = (ms: number) => formatUtcClock(new Date(ms));

/** Garrison: the enemy hits on our castle with their leaders, then the moments our refills land. */
export function garrisonChat(wave: readonly EnemyRally[], clockLabel: string, dict: Dictionary): string {
  const { hits, windows } = chatSummary(wave);
  const lines = [format(dict["sync.gar.chatHits"], { clock: clockLabel }), ...hits.map((h) => `${h.name} ${clock(h.at)}`)];
  if (windows.length > 0) lines.push("", format(dict["sync.gar.chatWindows"], { clock: clockLabel }), ...windows.map(clock), dict["sync.gar.chatSend"]);
  else if (hits.length > 1) lines.push("", dict["sync.gar.chatNoGap"]);
  return lines.join("\n");
}

export interface RallyChat {
  hitAt: number;
  rallyWaitSeconds: number;
  /** When the hit time was set: a leader whose start was already over then is marked "too late" instead of given a start. */
  hitSetAt: number | null;
  /** Leaders without a start time (sitting out, or in from the next rally) are left out. */
  leaders: ReadonlyArray<{ name: string; startAt: number | null }>;
}

/** Rally: the hit time, then every leader's start time, earliest first (the rally timer is named, so a leader on another timer notices). */
export function rallyChat({ hitAt, rallyWaitSeconds, hitSetAt, leaders }: RallyChat, clockLabel: string, dict: Dictionary): string {
  const lines = [format(dict["sync.chat.hit"], { time: clock(hitAt), clock: clockLabel })];
  const starts = leaders
    .flatMap((l) => (l.startAt === null ? [] : [{ name: l.name, at: l.startAt }]))
    .sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  if (starts.length > 0) lines.push("", format(dict["sync.chat.start"], { wait: formatSeconds(rallyWaitSeconds) }), ...starts.map((s) => (isTooLate(s.at, hitSetAt) ? format(dict["sync.chat.late"], { name: s.name }) : `${s.name} ${clock(s.at)}`)));
  return lines.join("\n");
}

/**
 * Counter-rally: the launch order with every leader's cue, from the third on also off the rally before. Two
 * styles for the game chat: the countdown an earlier rally shows ("2. Mira: Rajx 4:53"), or the seconds after
 * it started ("2. Mira: Rajx +7 s") for leaders who count on their own clock.
 */
export function counterChat(steps: ReadonlyArray<CounterStep<{ name: string }>>, rallyWaitSeconds: number, dict: Dictionary, style: "countdown" | "seconds" = "countdown"): string {
  const cue = (c: CounterCue) =>
    style === "seconds"
      ? `${c.name} ${format(dict["sync.gar.seconds"], { n: `+${c.gapSeconds}` })}`
      : c.seconds > 0
        ? `${c.name} ${formatSeconds(c.seconds)}`
        : format(dict["sync.chat.counterAfter"], { name: c.name, gap: c.gapSeconds });
  const lines = [style === "seconds" ? dict["sync.chat.counterGapTitle"] : format(dict["sync.chat.counterTitle"], { wait: formatSeconds(rallyWaitSeconds) })];
  for (const { leader, position, first, previous } of steps) {
    lines.push(first === null ? format(dict["sync.chat.counterFirst"], { n: position, name: leader.name }) : `${position}. ${leader.name}: ${[first, previous].flatMap((c) => (c ? [cue(c)] : [])).join(" / ")}`);
  }
  return lines.join("\n");
}
