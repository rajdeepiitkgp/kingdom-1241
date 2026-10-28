// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Pencil } from "lucide-react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import type { CounterCue, CounterStep } from "@/lib/rally-sync/counter";
import type { LeaderView } from "@/lib/rally-sync/room";
import { formatSeconds } from "@/lib/rally-sync/timing";
import { LeaderList } from "./LeaderList";

/** The cue in the leader's own card: as big as the rally page's start time, since they match it against the game. */
const BIG_CUE = "mt-1 text-[min(4.5rem,calc(26vw-20px))]/none font-black tabular";

/**
 * A counter-rally leader's own place in the launch order, big: the first
 * starts on the main alliance's word, everyone else when an earlier rally's
 * countdown (seen in the game's alliance war list) shows their cue. Nothing
 * here ticks: the order changes only when a march time does.
 */
export function CounterFocus({ step, dict }: { step: CounterStep<LeaderView>; dict: Dictionary }) {
  if (step.first === null) {
    return (
      <section className="rounded-card border-2 border-success bg-success-soft p-5 text-center md:p-6" data-tour="counter-focus">
        <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{dict["sync.counter.youFirst"]}</p>
        <p className="mt-2 text-2xl font-black text-ink">{dict["sync.counter.onGo"]}</p>
        <p className="mt-2 text-sm text-ink-muted">{dict["sync.counter.firstHint"]}</p>
      </section>
    );
  }
  const { first, previous } = step;
  return (
    <section className="rounded-card border-2 border-primary bg-primary-soft p-5 text-center md:p-6" data-tour="counter-focus">
      <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{format(dict["sync.counter.position"], { n: step.position })}</p>
      {first.seconds > 0 ? (
        <>
          <p className="mt-2 text-lg font-bold wrap-break-word text-ink" dir="auto">
            {format(dict["sync.counter.when"], { name: first.name })}
          </p>
          <p className={clsx(BIG_CUE, "text-ink")} dir="ltr">
            {formatSeconds(first.seconds)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-2xl font-black wrap-break-word text-ink" dir="auto">
          {format(dict["sync.counter.after"], { name: first.name, gap: first.gapSeconds })}
        </p>
      )}
      {previous && (
        <p className="mt-3 text-base font-bold wrap-break-word text-ink-muted" dir="auto">
          {previous.seconds > 0 ? format(dict["sync.counter.orWhen"], { name: previous.name, time: formatSeconds(previous.seconds) }) : format(dict["sync.counter.after"], { name: previous.name, gap: previous.gapSeconds })}
        </p>
      )}
      {/* The same moment for a leader who counts on their own clock: off the nearest earlier rally, the shorter count. */}
      {first.seconds > 0 && (
        <p className={clsx("text-sm font-semibold wrap-break-word text-ink-muted", previous ? "mt-1" : "mt-3")} dir="auto">
          {format(dict["sync.counter.orCount"], { name: (previous ?? first).name, gap: (previous ?? first).gapSeconds })}
        </p>
      )}
    </section>
  );
}

/**
 * The whole launch order, so every leader sees whose rally to watch. Leaders
 * sitting out follow at the end (the coordinator can bring them back); the
 * visitor's own row is marked.
 */
export function CounterSheet({
  steps,
  leaders,
  myId,
  rallyWaitSeconds,
  code,
  coordinatorToken,
  gameOffsetSeconds,
  dict,
  onChanged,
}: {
  steps: CounterStep<LeaderView>[];
  leaders: LeaderView[];
  myId: string | null;
  rallyWaitSeconds: number;
  code: string;
  coordinatorToken: string | null;
  gameOffsetSeconds: number;
  dict: Dictionary;
  onChanged: () => void;
}) {
  const stepOf = new Map(steps.map((s) => [s.leader.id, s]));
  const rows = [...steps.map((s) => s.leader), ...leaders.filter((l) => l.status === "inactive")];
  return (
    <div className="space-y-2" data-tour="counter-order">
      <LeaderList
        leaders={rows}
        title={format(dict["sync.counter.title"], { wait: formatSeconds(rallyWaitSeconds) })}
        empty={dict["sync.counter.empty"]}
        code={code}
        coordinatorToken={coordinatorToken}
        gameOffsetSeconds={gameOffsetSeconds}
        dict={dict}
        onChanged={onChanged}
        row={(leader, onEdit) => <CounterRow leader={leader} step={stepOf.get(leader.id) ?? null} mine={leader.id === myId} dict={dict} onEdit={onEdit} />}
      />
      {steps.length > 1 && <p className="px-1 text-xs text-ink-muted">{dict["sync.counter.hint"]}</p>}
    </div>
  );
}

function CounterRow({ leader, step, mine, dict, onEdit }: { leader: LeaderView; step: CounterStep<LeaderView> | null; mine: boolean; dict: Dictionary; onEdit?: () => void }) {
  const cue = (c: CounterCue, key: string) => (
    <span key={key} className="whitespace-nowrap">
      <span dir="auto">{c.name}</span>{" "}
      <span className="font-black text-ink tabular" dir="ltr">
        {c.seconds > 0 ? formatSeconds(c.seconds) : format(dict["sync.gar.seconds"], { n: `+${c.gapSeconds}` })}
      </span>
      {c.seconds > 0 && (
        <span className="ms-1 text-xs text-ink-faint tabular" dir="ltr">
          {format(dict["sync.gar.seconds"], { n: `+${c.gapSeconds}` })}
        </span>
      )}
    </span>
  );
  const content = (
    <>
      <span className="w-8 shrink-0 text-center text-lg font-black text-ink tabular">{step ? step.position : "–"}</span>
      <span className="min-w-0 flex-1">
        <span className="font-bold wrap-break-word text-ink" dir="auto">
          {leader.name}
        </span>
        {mine && <span className="chip ms-2 bg-primary align-middle text-primary-ink">{dict["sync.you"]}</span>}
        <span className="block text-xs font-semibold text-ink-faint">
          {dict["sync.march"]}{" "}
          <span className="tabular" dir="ltr">
            {formatSeconds(leader.marchSeconds)}
          </span>
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm font-semibold text-ink-muted">
          {step === null ? dict["sync.row.inactive"] : step.first === null ? dict["sync.counter.startsFirst"] : [cue(step.first, "first"), step.previous && cue(step.previous, "previous")]}
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
  const rowClass = clsx("flex w-full items-center gap-3 px-3 py-2.5 text-start", step === null && "opacity-60", mine && "bg-primary-soft");
  return onEdit ? (
    <button type="button" onClick={onEdit} className={clsx(rowClass, !mine && "hover:bg-card-soft")}>
      {content}
    </button>
  ) : (
    <div className={rowClass}>{content}</div>
  );
}
