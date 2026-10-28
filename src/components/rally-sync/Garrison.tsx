// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { Pencil, Trash2 } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { coordinate, type GarrisonOp } from "@/lib/rally-sync/actions";
import { garrisonChat } from "@/lib/rally-sync/chat";
import { updateDevice } from "@/lib/rally-sync/device";
import {
  currentWave,
  type EnemyLeader,
  type EnemyRally,
  focusSteps,
  hasLaunched,
  LAUNCH_CHIPS,
  MAX_SEND_SPACING_SECONDS,
  MIN_SEND_SPACING_SECONDS,
  type PlayerPlan,
  rallyHit,
  type RefillStep,
  refillStage,
  refillWindows,
  sendNowAdvice,
  WAVE_CLEAR_SECONDS,
  windowUpdated,
} from "@/lib/rally-sync/garrison";
import { NAME_MAX, type RoomView } from "@/lib/rally-sync/room";
import { formatSeconds, MAX_MARCH_SECONDS, parseDuration, secondsUntil } from "@/lib/rally-sync/timing";
import { CopyForChat } from "./CopyForChat";
import { useDevice, useRunner } from "./hooks";
import { type Clock, shown } from "./LeaderCards";
import { ErrorLine } from "./LeaderForm";
import { stepKeys } from "./step-keys";

/**
 * Garrison rooms (see garrison.ts). Players: their march time, kept on this
 * device, and a card per refill with the second to send, its countdown and,
 * for a send that has to wait for the previous one, the speedup that brings
 * it back into its window. Coordinator: the enemy rally leaders, the
 * countdown buttons that mark a rally, and the incoming list.
 */

/** The big clock of the refill that is next, sized like the rally page's start time. */
const BIG_CLOCK = "mt-1 text-[min(3.75rem,calc(23vw-20px))]/none font-black tabular md:text-7xl/none";
const SMALL_CLOCK = "mt-1 text-3xl/none font-black tabular";
/** SEND NOW / USE 25% NOW: big, but words wrap ("JETZT SENDEN" is wider than a clock). */
const BIG_ACTION = "mt-1 text-4xl/tight font-black wrap-break-word md:text-6xl/tight";
const SMALL_ACTION = "mt-1 text-2xl/tight font-black wrap-break-word";

/**
 * A sentence with its placeholders filled in, each value an unbreakable LTR
 * piece, so a time like "12:10:26" or "0:08" stays whole inside Arabic text.
 */
function Phrase({ template, values, strong }: { template: string; values: Record<string, string | number>; strong?: boolean }) {
  return (
    <>
      {template.split(/(\{\w+\})/).map((part, i) => {
        const key = /^\{(\w+)\}$/.exec(part)?.[1];
        return key !== undefined && key in values ? (
          <span key={i} dir="ltr" className={clsx("whitespace-nowrap tabular", strong && "font-bold text-ink")}>
            {values[key]}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export function GarrisonBoard({ plan, now, clock, dict }: { plan: PlayerPlan | null; now: number | null; clock: Clock; dict: Dictionary }) {
  const device = useDevice();
  const march = device.garrison.marchSeconds;
  const hits = plan ? plan.wave.map(rallyHit) : [];
  // The refills of the next burst of taps get big cards; the others wait small (focusSteps).
  const focus = plan && now !== null ? focusSteps(plan.steps, now) : [];

  return (
    <div className="space-y-3">
      <MarchSettings dict={dict} />
      {march !== null && plan && (
        <>
          {plan.wave.length === 0 ? (
            <p className="card px-5 py-6 text-center font-semibold text-ink-muted" data-tour="gar-refills">
              {dict["sync.gar.waiting"]}
            </p>
          ) : plan.windows.length === 0 ? (
            <p className="card px-5 py-6 text-center font-semibold text-ink-muted" data-tour="gar-refills">
              {dict["sync.gar.noGap"]}
            </p>
          ) : (
            <ol className="grid grid-cols-1 gap-3" data-tour="gar-refills">
              {plan.steps.map((step, index) => (
                <li key={step.number}>
                  <RefillCard step={step} plan={plan} march={march} big={focus.includes(index)} now={now} clock={clock} dict={dict} />
                </li>
              ))}
            </ol>
          )}
        </>
      )}
      {hits.length > 0 && (
        <p className="px-1 text-sm text-ink-muted">
          {dict["sync.gar.hits"]} · {clock.label}:{" "}
          <span dir="ltr" className="font-bold text-ink tabular">
            {hits.map(shown).join(" · ")}
          </span>
        </p>
      )}
    </div>
  );
}

/** The player's march to the castle and the seconds between their sends: a form until the march is set, then one line. */
function MarchSettings({ dict }: { dict: Dictionary }) {
  const device = useDevice();
  const { marchSeconds, spacingSeconds } = device.garrison;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const hint = dict["sync.stepHint"];

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const march = parseDuration(String(data.get("march") ?? ""));
    const spacingText = String(data.get("spacing") ?? "").trim();
    const spacing = /^\d{1,2}$/.test(spacingText) ? Number(spacingText) : NaN;
    if (march === null || march < 1 || march > MAX_MARCH_SECONDS || !(spacing >= MIN_SEND_SPACING_SECONDS && spacing <= MAX_SEND_SPACING_SECONDS)) {
      setError(true);
      return;
    }
    setError(false);
    updateDevice((d) => ({ ...d, garrison: { marchSeconds: march, spacingSeconds: spacing } }));
    setEditing(false);
  }

  if (marchSeconds !== null && !editing) {
    return (
      <p className="text-center text-base text-ink-muted" data-tour="gar-march">
        <Phrase template={dict["sync.gar.summary"]} values={{ march: formatSeconds(marchSeconds), spacing: spacingSeconds }} strong />{" "}
        <button type="button" className="font-bold text-primary underline" onClick={() => setEditing(true)}>
          {dict["sync.edit"]}
        </button>
      </p>
    );
  }

  return (
    <form onSubmit={save} key={`${marchSeconds}-${spacingSeconds}`} className="card p-4 md:p-5" data-tour="gar-march">
      {marchSeconds === null && <p className="mb-3 font-extrabold text-ink">{dict["sync.gar.needMarch"]}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="gar-march" className="label">
            {dict["sync.gar.march"]}
          </label>
          <input
            id="gar-march"
            name="march"
            className="input text-2xl font-black"
            defaultValue={marchSeconds === null ? "" : formatSeconds(marchSeconds)}
            placeholder="0:31"
            autoComplete="off"
            dir="ltr"
            {...stepKeys("duration", hint, { min: 1, max: MAX_MARCH_SECONDS })}
          />
          <p className="mt-1 text-xs text-ink-faint">{dict["sync.gar.marchHint"]}</p>
        </div>
        <div className="min-w-0">
          <label htmlFor="gar-spacing" className="label">
            {dict["sync.gar.spacing"]}
          </label>
          <input
            id="gar-spacing"
            name="spacing"
            className="input"
            defaultValue={String(spacingSeconds)}
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            {...stepKeys("seconds", hint, { min: MIN_SEND_SPACING_SECONDS, max: MAX_SEND_SPACING_SECONDS })}
          />
          <p className="mt-1 text-xs text-ink-faint">{dict["sync.gar.spacingHint"]}</p>
        </div>
      </div>
      {error && <ErrorLine dict={dict} error="invalid" invalidText={dict["sync.gar.invalidSettings"]} />}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn-primary btn-sm">
          {dict["sync.save"]}
        </button>
        {marchSeconds !== null && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>
            {dict["sync.cancel"]}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-muted">{dict["sync.gar.tip"]}</p>
    </form>
  );
}

/**
 * One refill: what to do now. Before the send its time and countdown (amber in
 * the last minute, red in the last 15 s), on the second SEND NOW, then the
 * planned speedup and its countdown, then "on the way" until it lands. While
 * the window is still reachable, a player who hasn't sent yet sees what to do
 * if they send right now.
 */
function RefillCard({ step, plan, march, big, now, clock, dict }: { step: RefillStep; plan: PlayerPlan; march: number; big: boolean; now: number | null; clock: Clock; dict: Dictionary }) {
  const updated = now !== null && windowUpdated(step.window, plan.wave, now);
  const header = (
    <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1", big ? "justify-center" : "justify-between")}>
      <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">
        <Phrase template={dict["sync.gar.refill"]} values={{ n: step.number, time: shown(step.window.target) }} />
      </p>
      {updated && <span className="chip bg-gold-soft text-gold-ink">{dict["sync.gar.updated"]}</span>}
    </div>
  );
  const between = (
    <p className="mt-0.5 text-xs text-ink-faint">
      <Phrase template={dict["sync.gar.between"]} values={{ a: shown(step.window.after), b: shown(step.window.before) }} />
    </p>
  );

  if (step.kind === "skip") {
    return (
      <section className="card-soft px-4 py-3">
        {header}
        {between}
        <p className="mt-2 text-sm font-bold text-ink-muted">{dict["sync.gar.skip"]}</p>
      </section>
    );
  }

  const stage = now === null ? "upcoming" : refillStage(step, now);
  const toSend = now === null ? null : secondsUntil(step.sendAt, now);
  const speedup = step.speedup;
  const thenLine = speedup && (
    <p className={clsx("mt-2 font-bold text-ink", big ? "text-base" : "text-sm")}>
      <Phrase template={dict["sync.gar.then"]} values={{ percent: speedup.percent, left: formatSeconds(speedup.atLeft) }} />
    </p>
  );
  // For a player who missed the planned second: sending now, with the speedup that still makes it (or "too late").
  const advice = now === null ? null : sendNowAdvice(step.window.target, march, now);
  const lateLine = advice && advice.lateSeconds > 0 && (stage === "speedup" || stage === "boost" || stage === "marching") && (
    <p className="mt-3 text-sm text-ink-muted">
      {advice.speedup ? <Phrase template={dict["sync.gar.late"]} values={{ percent: advice.speedup.percent, left: formatSeconds(advice.speedup.atLeft) }} /> : dict["sync.gar.missed"]}
    </p>
  );

  let tone = "card";
  if (stage === "send" || stage === "boost") tone = "rounded-card border-2 border-success bg-success-soft";
  else if (stage === "upcoming" && toSend !== null && toSend <= 15) tone = "rounded-card border-2 border-danger bg-danger-soft";
  else if (stage === "upcoming" && toSend !== null && toSend <= 60) tone = "rounded-card border-2 border-gold-strong bg-gold-soft";
  else if (stage === "done") tone = "card opacity-60";

  let body: ReactNode;
  switch (stage) {
    case "upcoming":
      body = (
        <>
          <p className="mt-3 text-xs font-bold tracking-wider text-ink-muted uppercase">
            {dict["sync.gar.sendAt"]} · {clock.label}
          </p>
          <p className={clsx(big ? BIG_CLOCK : SMALL_CLOCK, "text-ink")} dir="ltr">
            {shown(step.sendAt)}
          </p>
          {toSend !== null && (
            <p className={clsx("mt-2 font-bold", toSend <= 15 ? "text-danger" : "text-ink-muted", big ? "text-lg" : "text-sm")}>
              <Phrase template={dict["sync.gar.in"]} values={{ time: formatSeconds(toSend) }} />
            </p>
          )}
          {thenLine}
        </>
      );
      break;
    case "send":
      body = (
        <>
          <p className={clsx(big ? BIG_ACTION : SMALL_ACTION, "text-success")}>{dict["sync.gar.sendNow"]}</p>
          {thenLine}
        </>
      );
      break;
    case "speedup":
      body = (
        <>
          <p className={clsx("mt-3 font-black text-ink", big ? "text-2xl" : "text-lg")}>
            <Phrase template={dict["sync.gar.useAt"]} values={{ percent: speedup?.percent ?? 25, left: formatSeconds(speedup?.atLeft ?? 0) }} />
          </p>
          {now !== null && step.speedupAt !== null && (
            <p className="mt-1 font-bold text-ink-muted">
              <Phrase template={dict["sync.gar.in"]} values={{ time: formatSeconds(secondsUntil(step.speedupAt, now)) }} />
            </p>
          )}
          {lateLine}
        </>
      );
      break;
    case "boost":
      body = (
        <>
          <p className={clsx(big ? BIG_ACTION : SMALL_ACTION, "text-success")}>
            <Phrase template={dict["sync.gar.useNow"]} values={{ percent: speedup?.percent ?? 25 }} />
          </p>
          {lateLine}
        </>
      );
      break;
    case "marching":
      body = (
        <>
          <p className="mt-3 text-lg font-black text-ink">{dict["sync.gar.onTheWay"]}</p>
          {lateLine}
        </>
      );
      break;
    case "done":
      body = <p className="mt-2 text-sm font-bold text-ink-muted">{dict["sync.gar.landed"]}</p>;
      break;
  }

  return (
    <section className={clsx(tone, big ? "p-5 text-center md:p-6" : "px-4 py-3")}>
      {header}
      {between}
      {body}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coordinator
// ---------------------------------------------------------------------------

/** How long an armed "Clear all" or "Cancel rally" waits for the second tap. */
const CONFIRM_MS = 4000;

/** A button that needs a second tap within CONFIRM_MS, so a stray tap can't wipe a marked rally. */
function useConfirm() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return {
    armed,
    /** True on the second tap; the first one only arms. */
    confirm: () => {
      setArmed(!armed);
      return armed;
    },
  };
}

type Send = (where: string, op: GarrisonOp) => Promise<({ ok: true } & { enemyId?: string }) | null>;
type Runner = ReturnType<typeof useRunner>;

/**
 * The coordinator's view of a garrison room: the refill windows on top (the
 * result to check), then one card per enemy leader in a fixed order. Every
 * action sits inside the leader's own card, so a countdown can't be pressed
 * for the wrong leader, and each card shows only what fits its moment:
 * "Rally started" → the countdown buttons → launches in / ±1 s / re-time →
 * launched, lands at / correct landing time. Editing the list of leaders is a
 * separate mode, away from the live buttons.
 */
export function GarrisonControls({
  room,
  now,
  clock,
  token,
  exactNow,
  dict,
  onChanged,
}: {
  room: RoomView;
  now: number | null;
  clock: Clock;
  token: string;
  /** This page's corrected game-clock "now" in milliseconds, read at the moment of a tap. */
  exactNow: () => number;
  dict: Dictionary;
  onChanged: () => void;
}) {
  const runner = useRunner(onChanged);
  const send: Send = (where, op) => runner.run(where, () => coordinate(room.code, token, op, clock.offsetSeconds));
  const { enemies } = room.garrison;
  const [editingList, setEditingList] = useState(false);
  const clear = useConfirm();
  const wave = now === null ? [] : currentWave(room.garrison.rallies, now);
  const windows = refillWindows(wave.map(rallyHit));
  const busy = runner.pending !== null;
  const active = enemies.filter((e) => e.active);
  // A leader's latest rally in this wave (one may rally twice); earlier ones still count for the windows.
  const latest = (enemyId: string) => wave.filter((r) => r.enemyId === enemyId).sort((a, b) => Date.parse(b.launchAt) - Date.parse(a.launchAt))[0] ?? null;
  // A rally whose leader was unticked or removed after it was marked is coming either way: it keeps a card.
  const others = wave.filter((r) => !active.some((e) => e.id === r.enemyId)).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const clearError = runner.errorFor("clear");

  if (editingList) {
    return (
      <div className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold text-ink">{format(dict["sync.gar.enemies"], { n: enemies.length })}</h3>
          <button type="button" className="btn-primary btn-sm" onClick={() => setEditingList(false)}>
            {dict["sync.gar.done"]}
          </button>
        </div>
        <EnemyList enemies={enemies} clock={clock} dict={dict} send={send} pending={busy} errorFor={runner.errorFor} fail={runner.fail} />
      </div>
    );
  }

  const card = { now, clock, dict, busy, send, exactNow, runner };
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-xl border border-line bg-card-soft px-4 py-3" data-tour="gar-windows">
        <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">
          {dict["sync.gar.windows"]} · {clock.label}
        </p>
        {windows.length > 0 ? (
          <p className="mt-1 flex flex-wrap gap-x-4 text-2xl font-black text-ink tabular" dir="ltr">
            {windows.map((w) => (
              <span key={w.target}>{shown(w.target)}</span>
            ))}
          </p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-ink-muted">{dict[wave.length > 1 ? "sync.gar.noGap" : "sync.gar.windowsSoon"]}</p>
        )}
        {wave.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="w-full text-xs text-ink-faint">{format(dict["sync.gar.waveLine"], { n: wave.length, s: WAVE_CLEAR_SECONDS })}</p>
            <CopyForChat text={garrisonChat(wave, clock.label, dict)} dict={dict} />
            <button
              type="button"
              className={clsx("btn-sm ms-auto", clear.armed ? "btn-primary bg-danger" : "btn-ghost text-danger")}
              disabled={busy}
              onClick={() => {
                if (clear.confirm()) void send("clear", { type: "ralliesClear" });
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              {clear.armed ? dict["sync.gar.clearConfirm"] : dict["sync.gar.clear"]}
            </button>
          </div>
        )}
        {clearError && <ErrorLine dict={dict} error={clearError} />}
      </div>

      {enemies.length === 0 && (
        <div className="card-soft p-4 text-center" data-tour="gar-enemies">
          <p className="text-sm text-ink-muted">{dict["sync.gar.noEnemies"]}</p>
          <button type="button" className="btn-primary btn-sm mt-3" onClick={() => setEditingList(true)}>
            {dict["sync.gar.addFirst"]}
          </button>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-3" data-tour="gar-enemies">
        {active.map((enemy) => (
          <li key={enemy.id}>
            <EnemyCard enemy={enemy} rally={latest(enemy.id)} {...card} />
          </li>
        ))}
        {others.map((rally) => (
          <li key={rally.id}>
            <EnemyCard enemy={null} rally={rally} {...card} />
          </li>
        ))}
      </ul>

      {enemies.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingList(true)} data-tour="gar-edit">
            <Pencil className="size-4" aria-hidden />
            {dict["sync.gar.editList"]}
          </button>
          {enemies.length > active.length && <p className="text-xs text-ink-faint">{format(dict["sync.gar.hidden"], { n: enemies.length - active.length })}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * One enemy leader: waiting (one big "Rally started" button), picking the
 * countdown, marked (launches in, ±1 s, re-time, until it launches) or
 * launched (lands in / lands at, and "correct landing time" read off the
 * incoming march). `enemy` is null for a rally whose leader left the list.
 */
function EnemyCard({
  enemy,
  rally,
  now,
  clock,
  dict,
  busy,
  send,
  exactNow,
  runner,
}: {
  enemy: EnemyLeader | null;
  rally: EnemyRally | null;
  now: number | null;
  clock: Clock;
  dict: Dictionary;
  busy: boolean;
  send: Send;
  exactNow: () => number;
  runner: Runner;
}) {
  const [picking, setPicking] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [editingMarch, setEditingMarch] = useState(false);
  const cancel = useConfirm();
  const where = `card-${enemy?.id ?? rally?.id ?? ""}`;
  const hit = rally === null ? null : rallyHit(rally);
  const landed = hit !== null && now !== null && hit <= now;
  const launched = rally !== null && now !== null && hasLaunched(rally, now);
  const stage = picking ? "picking" : rally === null || landed ? "waiting" : launched ? "launched" : "marked";
  const error = runner.errorFor(where);

  function mark(countdownSeconds: number) {
    const tappedAt = exactNow(); // first: the moment of the tap is what counts
    if (enemy) void send(where, { type: "rallyMark", enemyId: enemy.id, countdownSeconds, tappedAt }).then((done) => done && setPicking(false));
  }

  function landsIn(landsInSeconds: number) {
    const tappedAt = exactNow();
    if (enemy) void send(where, { type: "rallyLands", enemyId: enemy.id, landsInSeconds, tappedAt }).then((done) => done && setCorrecting(false));
  }

  function saveMarch(marchSeconds: number) {
    if (enemy) void send(where, { type: "enemySave", enemyId: enemy.id, name: enemy.name, marchSeconds }).then((done) => done && setEditingMarch(false));
  }

  const march = formatSeconds(enemy?.marchSeconds ?? rally?.marchSeconds ?? 0);
  // The leader's march time, changeable right here (pets speed a leader up for two hours): top right, away from the countdown buttons.
  const header = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="min-w-0 text-lg font-extrabold wrap-break-word text-ink" dir="auto">
          {enemy?.name ?? rally?.name}
        </h3>
        {enemy ? (
          <button
            type="button"
            className="btn-ghost btn-sm shrink-0"
            aria-expanded={editingMarch}
            title={dict["sync.gar.editMarch"]}
            onClick={() => setEditingMarch((v) => !v)}
          >
            <Phrase template={dict["sync.gar.marchOf"]} values={{ march }} />
            <Pencil className="size-3.5" aria-hidden />
          </button>
        ) : (
          <span className="text-sm text-ink-muted">
            <Phrase template={dict["sync.gar.marchOf"]} values={{ march }} />
          </span>
        )}
      </div>
      {enemy && editingMarch && (
        <MarchEditor enemy={enemy} launched={launched} clock={clock} dict={dict} busy={busy} where={where} onSave={saveMarch} onCancel={() => setEditingMarch(false)} onInvalid={() => runner.fail(where, "invalid")} />
      )}
    </>
  );
  const cancelButton = rally && (
    <button
      type="button"
      className={clsx("btn-sm ms-auto", cancel.armed ? "btn-primary bg-danger" : "btn-ghost text-danger")}
      disabled={busy}
      onClick={() => {
        if (cancel.confirm()) void send(where, { type: "rallyRemove", rallyId: rally.id });
      }}
    >
      {cancel.armed ? dict["sync.gar.cancelConfirm"] : dict["sync.gar.cancelRally"]}
    </button>
  );
  const errorLine = error && <ErrorLine dict={dict} error={error} invalidText={dict["sync.error.invalidDuration"]} />;

  if (stage === "picking") {
    return (
      <section className="rounded-card border-2 border-primary bg-card px-4 py-3">
        {header}
        <p className="label mt-3">{dict["sync.gar.when"]}</p>
        <div className="grid grid-cols-4 gap-2" dir="ltr">
          {LAUNCH_CHIPS.map((seconds) => (
            <button key={seconds} type="button" className="btn-ghost justify-center tabular" disabled={busy} onClick={() => mark(seconds)}>
              {formatSeconds(seconds)}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <TapField id={`${where}-other`} label={dict["sync.gar.typed"]} hint={dict["sync.gar.typedHint"]} placeholder="4:08" disabled={busy} dict={dict} onTap={mark} onInvalid={() => runner.fail(where, "invalid")} />
        </div>
        <button type="button" className="btn-ghost btn-sm mt-3" onClick={() => setPicking(false)}>
          {dict["sync.cancel"]}
        </button>
        {errorLine}
      </section>
    );
  }

  if (stage === "marked" && rally && hit !== null && now !== null) {
    return (
      <section className="rounded-card border-2 border-gold-strong bg-gold-soft px-4 py-3">
        {header}
        <p className="mt-2 text-xl font-black text-ink">
          <Phrase template={dict["sync.gar.launchesIn"]} values={{ time: formatSeconds(secondsUntil(Date.parse(rally.launchAt), now)) }} />
        </p>
        <p className="text-sm font-bold text-ink-muted">
          <Phrase template={dict["sync.gar.lands"]} values={{ time: `${shown(hit)} ${clock.label}` }} />
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost btn-sm tabular" disabled={busy} aria-label={dict["sync.gar.earlier"]} title={dict["sync.gar.earlier"]} onClick={() => void send(where, { type: "rallyNudge", rallyId: rally.id, deltaSeconds: -1 })}>
            <Phrase template={dict["sync.gar.seconds"]} values={{ n: "−1" }} />
          </button>
          <button type="button" className="btn-ghost btn-sm tabular" disabled={busy} aria-label={dict["sync.gar.later"]} title={dict["sync.gar.later"]} onClick={() => void send(where, { type: "rallyNudge", rallyId: rally.id, deltaSeconds: 1 })}>
            <Phrase template={dict["sync.gar.seconds"]} values={{ n: "+1" }} />
          </button>
          {enemy && (
            <button type="button" className="btn-ghost btn-sm" disabled={busy} onClick={() => setPicking(true)}>
              {dict["sync.gar.retime"]}
            </button>
          )}
          {cancelButton}
        </div>
        {errorLine}
      </section>
    );
  }

  if (stage === "launched" && rally && hit !== null && now !== null) {
    // Ticks like the game's "lands in", so a second or two off shows at a glance (then: correct landing time).
    return (
      <section className="rounded-card border-2 border-danger/50 bg-card px-4 py-3">
        {header}
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <span className="chip bg-danger-soft text-danger">{dict["sync.gar.launched"]}</span>
          <span className="text-xl font-black text-ink">
            <Phrase template={dict["sync.gar.landsInTime"]} values={{ time: formatSeconds(secondsUntil(hit, now)) }} />
          </span>
        </p>
        <p className="text-sm font-bold text-ink-muted">
          <Phrase template={dict["sync.gar.lands"]} values={{ time: `${shown(hit)} ${clock.label}` }} />
        </p>
        {correcting && (
          <div className="mt-3">
            <TapField id={`${where}-lands`} label={dict["sync.gar.landsIn"]} hint={dict["sync.gar.landsInHint"]} placeholder="0:35" disabled={busy} dict={dict} onTap={landsIn} onInvalid={() => runner.fail(where, "invalid")} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {enemy && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setCorrecting((v) => !v)}>
              {correcting ? dict["sync.cancel"] : dict["sync.gar.correct"]}
            </button>
          )}
          {cancelButton}
        </div>
        {errorLine}
      </section>
    );
  }

  // Waiting for this leader's next rally (after one that landed, its time stays as a note).
  return (
    <section className="card px-4 py-3">
      {header}
      {landed && hit !== null && (
        <p className="mt-1 text-sm text-ink-muted">
          <Phrase template={dict["sync.gar.enemyLanded"]} values={{ time: `${shown(hit)} ${clock.label}` }} />
        </p>
      )}
      {enemy && (
        <button type="button" className="btn-gold mt-3 w-full" disabled={busy} onClick={() => setPicking(true)}>
          {dict["sync.gar.rallyStarted"]}
        </button>
      )}
      {errorLine}
    </section>
  );
}


/**
 * A leader's march time, edited inside their card: the field, and the previous
 * value one tap away (pets wear off after two hours). A rally of theirs that
 * hasn't launched takes the new time; one that has keeps its time unless its
 * landing is corrected.
 */
function MarchEditor({
  enemy,
  launched,
  clock,
  dict,
  busy,
  where,
  onSave,
  onCancel,
  onInvalid,
}: {
  enemy: EnemyLeader;
  launched: boolean;
  clock: Clock;
  dict: Dictionary;
  busy: boolean;
  where: string;
  onSave: (marchSeconds: number) => void;
  onCancel: () => void;
  onInvalid: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const march = parseDuration(String(new FormData(event.currentTarget).get("march") ?? ""));
    if (march === null || march < 1 || march > MAX_MARCH_SECONDS) onInvalid();
    else onSave(march);
  }
  return (
    <form onSubmit={submit} key={enemy.marchSeconds} className="mt-3 rounded-xl border border-line bg-card p-3">
      <label htmlFor={`${where}-march`} className="label">
        {dict["sync.gar.enemyMarch"]}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`${where}-march`}
          name="march"
          className="input min-w-0 flex-1 basis-24 text-xl font-black"
          defaultValue={formatSeconds(enemy.marchSeconds)}
          autoComplete="off"
          dir="ltr"
          {...stepKeys("duration", dict["sync.stepHint"], { min: 1, max: MAX_MARCH_SECONDS })}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy}>
          {dict["sync.save"]}
        </button>
        <button type="button" className="btn-ghost shrink-0" onClick={onCancel}>
          {dict["sync.cancel"]}
        </button>
      </div>
      {enemy.previousMarchSeconds !== null && enemy.marchChangedAt && (
        <p className="mt-2 text-sm text-ink-muted">
          <Phrase template={dict["sync.gar.was"]} values={{ march: formatSeconds(enemy.previousMarchSeconds), time: `${shown(Date.parse(enemy.marchChangedAt))} ${clock.label}` }} />{" "}
          <button type="button" className="font-bold text-primary underline" disabled={busy} onClick={() => onSave(enemy.previousMarchSeconds ?? enemy.marchSeconds)}>
            <Phrase template={dict["sync.gar.useAgain"]} values={{ march: formatSeconds(enemy.previousMarchSeconds) }} />
          </button>
        </p>
      )}
      {launched && <p className="mt-2 text-xs text-ink-faint">{dict["sync.gar.marchLaunchedHint"]}</p>}
    </form>
  );
}

/** A duration field with a Now button: the moment of the tap (or Enter) is what counts, so the value is typed ahead. */
function TapField({
  id,
  label,
  hint,
  placeholder,
  disabled,
  dict,
  onTap,
  onInvalid,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  disabled: boolean;
  dict: Dictionary;
  onTap: (seconds: number) => void;
  onInvalid: () => void;
}) {
  function tap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const seconds = parseDuration(String(new FormData(event.currentTarget).get("value") ?? ""));
    if (seconds === null || seconds < 1 || seconds > MAX_MARCH_SECONDS) onInvalid();
    else onTap(seconds);
  }
  return (
    <form onSubmit={tap} className="min-w-0">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} name="value" className="input min-w-0" placeholder={placeholder} autoComplete="off" dir="ltr" {...stepKeys("duration", dict["sync.stepHint"], { min: 1, max: MAX_MARCH_SECONDS })} />
        <button type="submit" className="btn-gold shrink-0" disabled={disabled}>
          {dict["sync.gar.now"]}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </form>
  );
}

/** Name (optional for a new leader) and march time to our castle. */
function EnemyForm({
  idPrefix,
  defaults,
  submitLabel,
  pending,
  dict,
  onSubmit,
  onInvalid,
  children,
}: {
  idPrefix: string;
  defaults?: { name: string; marchSeconds: number };
  submitLabel: string;
  pending: boolean;
  dict: Dictionary;
  onSubmit: (name: string, marchSeconds: number, form: HTMLFormElement) => void;
  onInvalid: () => void;
  children?: ReactNode;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const march = parseDuration(String(data.get("march") ?? ""));
    if (march === null || march < 1 || march > MAX_MARCH_SECONDS || name.length > NAME_MAX || (defaults && !name)) onInvalid();
    else onSubmit(name, march, event.currentTarget);
  }
  return (
    <form onSubmit={submit} className="card-soft mt-3 px-4 py-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-name`} className="label">
            {defaults ? dict["sync.form.name"] : dict["sync.gar.enemyName"]}
          </label>
          <input id={`${idPrefix}-name`} name="name" className="input" defaultValue={defaults?.name ?? ""} maxLength={NAME_MAX} autoComplete="off" dir="auto" />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-march`} className="label">
            {dict["sync.gar.enemyMarch"]}
          </label>
          <input
            id={`${idPrefix}-march`}
            name="march"
            className="input"
            defaultValue={defaults ? formatSeconds(defaults.marchSeconds) : ""}
            placeholder="0:42"
            autoComplete="off"
            dir="ltr"
            {...stepKeys("duration", dict["sync.stepHint"], { min: 1, max: MAX_MARCH_SECONDS })}
          />
        </div>
      </div>
      {!defaults && <p className="mt-1 text-xs text-ink-faint">{dict["sync.gar.enemyMarchHint"]}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          {submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
}

/**
 * Every enemy leader: tick who rallies this time, fix a name or march time,
 * go back to the previous march time (pets wear off after two hours), add or
 * remove one. Their march times stay while the room is open.
 */
function EnemyList({
  enemies,
  clock,
  dict,
  send,
  pending,
  errorFor,
  fail,
}: {
  enemies: EnemyLeader[];
  clock: Clock;
  dict: Dictionary;
  send: (where: string, op: GarrisonOp) => Promise<unknown>;
  pending: boolean;
  errorFor: ReturnType<typeof useRunner>["errorFor"];
  fail: ReturnType<typeof useRunner>["fail"];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [added, setAdded] = useState(0);
  const errorLine = (where: string) => {
    const error = errorFor(where);
    return error && <ErrorLine dict={dict} error={error} invalidText={dict["sync.gar.invalidEnemy"]} />;
  };

  return (
    <div>
      <p className="mb-2 text-xs text-ink-muted">{dict["sync.gar.enemiesHint"]}</p>
      {enemies.length > 0 && (
        <ul className="divide-y divide-line">
          {enemies.map((enemy) =>
            editing === enemy.id ? (
              <li key={enemy.id} className="py-2">
                <EnemyForm
                  idPrefix={`gar-edit-${enemy.id}`}
                  defaults={enemy}
                  submitLabel={dict["sync.save"]}
                  pending={pending}
                  dict={dict}
                  onInvalid={() => fail(enemy.id, "invalid")}
                  onSubmit={(name, marchSeconds) =>
                    void send(enemy.id, { type: "enemySave", enemyId: enemy.id, name, marchSeconds }).then((ok) => {
                      if (ok) setEditing(null);
                    })
                  }
                >
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                    {dict["sync.cancel"]}
                  </button>
                </EnemyForm>
                {errorLine(enemy.id)}
              </li>
            ) : (
              <li key={enemy.id} className="py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label className="flex min-w-0 flex-1 basis-40 items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={enemy.active}
                      disabled={pending}
                      title={dict["sync.gar.active"]}
                      onChange={(event) => void send(enemy.id, { type: "enemyActive", enemyId: enemy.id, active: event.currentTarget.checked })}
                    />
                    <span className={clsx("font-bold wrap-break-word", enemy.active ? "text-ink" : "text-ink-faint line-through")} dir="auto">
                      {enemy.name}
                    </span>
                    <span className="text-sm text-ink-muted tabular" dir="ltr">
                      {formatSeconds(enemy.marchSeconds)}
                    </span>
                  </label>
                  <span className="flex items-center gap-1">
                    <button type="button" className="btn-ghost btn-sm px-2" aria-label={dict["sync.edit"]} title={dict["sync.edit"]} onClick={() => setEditing(enemy.id)}>
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button type="button" className="btn-ghost btn-sm px-2 text-danger" disabled={pending} aria-label={dict["sync.remove"]} title={dict["sync.remove"]} onClick={() => void send(enemy.id, { type: "enemyRemove", enemyId: enemy.id })}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </span>
                </div>
                {enemy.previousMarchSeconds !== null && enemy.marchChangedAt && (
                  <p className="mt-1 text-xs text-ink-faint">
                    <Phrase template={dict["sync.gar.was"]} values={{ march: formatSeconds(enemy.previousMarchSeconds), time: `${shown(Date.parse(enemy.marchChangedAt))} ${clock.label}` }} />{" "}
                    <button
                      type="button"
                      className="font-bold text-primary underline"
                      disabled={pending}
                      onClick={() => void send(enemy.id, { type: "enemySave", enemyId: enemy.id, name: enemy.name, marchSeconds: enemy.previousMarchSeconds ?? enemy.marchSeconds })}
                    >
                      <Phrase template={dict["sync.gar.useAgain"]} values={{ march: formatSeconds(enemy.previousMarchSeconds) }} />
                    </button>
                  </p>
                )}
                {errorLine(enemy.id)}
              </li>
            ),
          )}
        </ul>
      )}
      <EnemyForm
        key={added}
        idPrefix="gar-list-add"
        submitLabel={dict["sync.coord.add"]}
        pending={pending}
        dict={dict}
        onInvalid={() => fail("list-add", "invalid")}
        onSubmit={(name, marchSeconds) =>
          void send("list-add", { type: "enemySave", name, marchSeconds }).then((ok) => {
            if (ok) setAdded((n) => n + 1);
          })
        }
      />
      {errorLine("list-add")}
    </div>
  );
}
