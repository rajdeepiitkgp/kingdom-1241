// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Pencil } from "lucide-react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { type LeaderView, type RoomView, startChanged } from "@/lib/rally-sync/room";
import { formatSeconds, isTooLate, secondsUntil, startAt, startStage, type StartStage } from "@/lib/rally-sync/timing";
import { formatUtcClock } from "@/lib/time";

export type TimedLeaderView = LeaderView & { startAt: number | null };

/**
 * This device's clock settings. Every stored time is a game-clock time and is
 * shown as it is; the adjustment only moves this device's "now" (see
 * timing.ts), so the label says "UTC" until the player sets one.
 */
export interface Clock {
  offsetSeconds: number;
  /** "UTC", or "game clock" when adjusted. */
  label: string;
}

/** "15:04:48" (a game-clock time, which is UTC unless adjusted). */
export function shown(ms: number): string {
  return formatUtcClock(new Date(ms));
}

/**
 * The big clocks on a phone: 3.75rem, but never wider than the card, so
 * "00:00:00" still fits a 320px screen at the largest text size (125%).
 */
const BIG_CLOCK = "mt-1 text-[min(3.75rem,calc(23vw-20px))]/none font-black tabular";

/** The visitor's start time: the same size in every stage, so it never jumps or shrinks when the countdown starts. */
const START_TIME = clsx(BIG_CLOCK, "md:text-8xl/none");

/**
 * The one big block at the top of the room: the visitor's own start time
 * (from "get ready" on, the amber / red / GO countdown), or for someone who
 * isn't leading a rally, when the rallies land. Everything else on the page
 * is smaller on purpose.
 */
export function FocusBlock({ me, room, now, clock, dict }: { me: TimedLeaderView | null; room: RoomView; now: number | null; clock: Clock; dict: Dictionary }) {
  const hitAt = room.hitAt ? Date.parse(room.hitAt) : null;
  const hitSetAt = room.hitSetAt ? Date.parse(room.hitSetAt) : null;
  const footer = (
    <p className="mt-3 text-sm font-semibold text-ink-muted tabular" dir="ltr">
      {now !== null && <span>{format(dict["sync.hero.now"], { time: shown(now) })}</span>}
      {hitAt !== null && me && <span> · {format(dict["sync.hero.lands"], { time: shown(hitAt) })}</span>}
      {room.mode === "counter" && room.enemyHitAt && (
        <span className="block font-medium" dir="auto">
          {format(dict["sync.hit.enemy"], { time: `${shown(Date.parse(room.enemyHitAt))} ${clock.label}`, offset: room.counterOffsetSeconds })}
        </span>
      )}
    </p>
  );

  // Not leading a rally (viewer, or a coordinator only): when everything lands.
  if (!me) {
    const left = hitAt !== null && now !== null ? secondsUntil(hitAt, now) : null;
    return (
      <section className="card p-5 text-center md:p-6">
        {hitAt === null ? (
          <p className="font-semibold text-ink-muted">{dict["sync.hit.none"]}</p>
        ) : (
          <>
            <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">
              {dict["sync.hit.title"]} · {clock.label}
            </p>
            <p className={clsx(BIG_CLOCK, "text-ink md:text-7xl/none")} dir="ltr">
              {shown(hitAt)}
            </p>
            {left !== null && <p className="mt-2 text-lg font-bold text-ink-muted">{left > 0 ? format(dict["sync.hit.in"], { time: formatSeconds(left) }) : dict["sync.hit.landed"]}</p>}
          </>
        )}
        {footer}
      </section>
    );
  }

  const start = me.startAt;
  if (start === null) {
    return (
      <section className="card p-5 text-center md:p-6">
        <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{dict["sync.yourStart"]}</p>
        <p className={clsx(BIG_CLOCK, "text-ink-faint md:text-7xl/none")} dir="ltr">
          --:--:--
        </p>
        <p className="mt-3 font-semibold text-ink-muted">{dict["sync.hit.none"]}</p>
        {footer}
      </section>
    );
  }

  if (isTooLate(start, hitSetAt)) {
    return (
      <section className="rounded-card border-2 border-danger bg-danger-soft p-5 text-center md:p-6">
        <p className="text-lg font-black text-danger">{dict["sync.leader.tooLate"]}</p>
        <p className="mt-1 text-sm font-semibold text-danger">{dict["sync.hero.tooLateHint"]}</p>
        {footer}
      </section>
    );
  }

  const stage = now === null ? "waiting" : startStage(start, now);
  if (now !== null && (stage === "ready" || stage === "alert" || stage === "go")) return <MyAlert stage={stage} start={start} now={now} clock={clock} dict={dict} />;

  const left = now === null ? null : secondsUntil(start, now);
  return (
    <section className={clsx("card p-5 text-center md:p-6", stage === "passed" && "opacity-70")}>
      <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">
        {dict["sync.yourStart"]} · {clock.label}
      </p>
      <p className={clsx(START_TIME, "text-ink")} dir="ltr">
        {shown(start)}
      </p>
      <p className="mt-2 text-lg font-bold text-ink-muted">
        {stage === "passed" ? dict["sync.started"] : left !== null ? format(dict["sync.hit.in"], { time: formatSeconds(left) }) : " "}
      </p>
      {footer}
    </section>
  );
}

/**
 * The visitor's own rally from "get ready" to GO. Players start on the game
 * clock, so the start time stays the main thing, exactly as big as before;
 * the countdown under it is the guide: larger now, but smaller than the time.
 * The block turns amber, then red and pulsing, then green for GO.
 */
function MyAlert({ stage, start, now, clock, dict }: { stage: "ready" | "alert" | "go"; start: number; now: number; clock: Clock; dict: Dictionary }) {
  const left = secondsUntil(start, now);
  const body = (
    <>
      <p className="text-xs font-bold tracking-wider uppercase opacity-85">
        {dict["sync.yourStart"]} · {clock.label}
      </p>
      <p className={START_TIME} dir="ltr">
        {shown(start)}
      </p>
      <p className="mt-4 text-base font-black md:text-lg">
        {stage === "ready" ? dict["sync.alert.ready"] : stage === "alert" ? dict["sync.alert.now"] : dict["sync.alert.goHint"]}
      </p>
      <p className="mt-1 text-4xl/none font-black tabular md:text-5xl/none" dir={stage === "go" ? undefined : "ltr"}>
        {stage === "ready" ? formatSeconds(left) : stage === "alert" ? left : dict["sync.alert.go"]}
      </p>
    </>
  );

  if (stage === "ready") {
    return <section className="rounded-card border-2 border-gold-strong bg-gold-soft p-5 text-center text-gold-ink shadow-lift md:p-6">{body}</section>;
  }

  if (stage === "alert") {
    return (
      <section className="overflow-hidden rounded-card bg-danger text-center text-on-danger shadow-lift">
        {/* Keyed by the second, so the pulse restarts exactly on each tick. */}
        <div key={left} className="p-5 motion-safe:animate-rally-pulse md:p-6">
          {body}
        </div>
      </section>
    );
  }

  return <section className="rounded-card bg-success p-5 text-center text-on-success shadow-lift motion-safe:animate-rally-flash md:p-6">{body}</section>;
}

/** Does the focus block need to stay on screen while the page scrolls (the last minute before the visitor's start)? */
export function isUrgent(me: TimedLeaderView | null, room: RoomView, now: number | null): boolean {
  if (!me || me.startAt === null || now === null) return false;
  if (isTooLate(me.startAt, room.hitSetAt ? Date.parse(room.hitSetAt) : null)) return false;
  const stage = startStage(me.startAt, now);
  return stage === "ready" || stage === "alert" || stage === "go";
}

const ROW_ACCENT: Record<StartStage, string> = {
  waiting: "border-s-transparent",
  ready: "border-s-gold-strong",
  alert: "border-s-danger",
  go: "border-s-success",
  passed: "border-s-transparent",
};

/**
 * Another leader as a slim row: start time with its status underneath, name
 * and march. `quiet` (a leader's view) keeps it all grey so the eye stays on
 * the visitor's own block; the coordinator's view shows the stage as a
 * coloured edge and status colour, and the row opens the editor.
 */
export function LeaderRow({
  leader,
  now,
  room,
  quiet,
  dict,
  onEdit,
}: {
  leader: TimedLeaderView;
  now: number | null;
  room: RoomView;
  quiet: boolean;
  dict: Dictionary;
  onEdit?: () => void;
}) {
  const start = leader.startAt;
  const late = start !== null && isTooLate(start, room.hitSetAt ? Date.parse(room.hitSetAt) : null);
  const stage: StartStage | null = start !== null && now !== null ? startStage(start, now) : null;
  const left = start !== null && now !== null ? secondsUntil(start, now) : null;
  const hitAt = room.hitAt ? Date.parse(room.hitAt) : null;
  const previousStart =
    startChanged(leader, room.hitSetAt) && hitAt !== null && leader.previousMarchSeconds !== null ? startAt(hitAt, room.rallyWaitSeconds, leader.previousMarchSeconds) : null;
  const status = late
    ? dict["sync.row.late"]
    : stage === "go"
      ? dict["sync.alert.go"]
      : stage === "passed"
        ? dict["sync.started"]
        : left !== null
          ? format(dict["sync.hit.in"], { time: formatSeconds(left) })
          : "";
  const statusColour = quiet
    ? "text-ink-faint"
    : late || stage === "alert"
      ? "text-danger"
      : stage === "go"
        ? "text-success"
        : stage === "ready"
          ? "text-gold-ink"
          : "text-ink-muted";

  const content = (
    <>
      {/* Start time with its status underneath, so the name keeps the width on a phone at large text. */}
      <span className="flex w-24 shrink-0 flex-col">
        <span
          className={clsx("font-black tabular", quiet ? "text-base text-ink-muted" : "text-lg", !quiet && (late || stage === "passed" ? "text-ink-faint" : "text-ink"))}
          dir="ltr"
        >
          {start === null ? "--:--:--" : shown(start)}
        </span>
        {status && <span className={clsx("text-xs font-extrabold tabular", statusColour)}>{status}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("wrap-break-word", quiet ? "text-sm font-semibold text-ink-muted" : "font-bold text-ink")} dir="auto">
          {leader.name}
        </span>
        <span className="block text-xs font-semibold text-ink-faint">
          {dict["sync.march"]}{" "}
          <span className="tabular" dir="ltr">
            {formatSeconds(leader.marchSeconds)}
          </span>
          {previousStart !== null && <span className="ms-1 font-bold text-gold-ink">· {format(dict["sync.leader.changed"], { time: shown(previousStart) })}</span>}
        </span>
      </span>
      {onEdit && (
        <>
          <Pencil className="size-4 shrink-0 text-ink-faint" aria-hidden />
          <span className="sr-only">{dict["sync.edit"]}</span>
        </>
      )}
    </>
  );

  const rowClass = clsx(
    "flex w-full items-center gap-3 px-3 text-start",
    quiet ? "py-2" : ["border-s-4 py-2.5", stage && !late ? ROW_ACCENT[stage] : "border-s-transparent"],
  );
  return onEdit ? (
    <button type="button" onClick={onEdit} className={clsx(rowClass, "hover:bg-card-soft")}>
      {content}
    </button>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}
