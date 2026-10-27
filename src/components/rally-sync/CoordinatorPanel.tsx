// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { ChevronDown, Crown, RefreshCw, Shield, Swords, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { coordinate, type CoordinatorOp } from "@/lib/rally-sync/actions";
import { updateDevice } from "@/lib/rally-sync/device";
import { IDLE_CLOSE_MS, type RoomMode, type RoomView } from "@/lib/rally-sync/room";
import { earliestHit, formatSeconds, isTooLate, MAX_BUFFER_SECONDS, MAX_COUNTER_OFFSET_SECONDS, parseDuration } from "@/lib/rally-sync/timing";
import { useRunner } from "./hooks";
import { InvitePanel } from "./InvitePanel";
import { type Clock, shown, type TimedLeaderView } from "./LeaderCards";
import { ErrorLine, LeaderForm } from "./LeaderForm";

/**
 * The coordinator's controls. Always visible: the mode and the hit time
 * (one-tap Re-sync in rally mode; the enemy's arrival in counter-rally mode).
 * Behind "More options": settings, adding a leader, inviting, the previous hit
 * times, clearing the hit time and destroying the room. Times are typed and
 * shown on this device's clock (game clock when adjusted); every change goes
 * through the `coordinate` action with this device's coordinator token.
 */
export function CoordinatorPanel({
  room,
  leaders,
  now,
  clock,
  token,
  dict,
  locale,
  onChanged,
}: {
  room: RoomView;
  leaders: TimedLeaderView[];
  now: number | null;
  clock: Clock;
  token: string;
  dict: Dictionary;
  locale: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { pending, run, errorFor, fail } = useRunner(onChanged);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [more, setMore] = useState(false);
  // Remounts the "add a leader" form after each add, so it starts empty again.
  const [added, setAdded] = useState(0);
  const send = (where: string, op: CoordinatorOp) => run(where, () => coordinate(room.code, token, op, clock.offsetSeconds));

  const hitSetAt = room.hitSetAt ? Date.parse(room.hitSetAt) : null;
  const late = leaders.filter((l) => l.startAt !== null && isTooLate(l.startAt, hitSetAt));
  const longest = leaders.reduce((max, l) => Math.max(max, l.marchSeconds), 0);
  const preview = now === null ? null : earliestHit(now, room.rallyWaitSeconds, [longest], room.bufferSeconds);

  /** A one-field form (time or duration): sends the op and clears the field when it worked. */
  const fieldSubmit = (where: string, op: (text: string) => CoordinatorOp) => async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = String(new FormData(form).get("value") ?? "").trim();
    if (!text) return;
    if (await send(where, op(text))) form.reset();
  };

  function setMode(mode: RoomMode) {
    if (mode === room.mode) return;
    void send("mode", { type: "settings", mode, rallyWaitSeconds: room.rallyWaitSeconds, bufferSeconds: room.bufferSeconds, counterOffsetSeconds: room.counterOffsetSeconds });
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const rallyWaitSeconds = parseDuration(String(data.get("wait") ?? ""));
    const bufferSeconds = Number(data.get("buffer"));
    const counterOffsetSeconds = Number(data.get("offset"));
    if (rallyWaitSeconds === null) return fail("settings", "invalid");
    await send("settings", { type: "settings", mode: room.mode, rallyWaitSeconds, bufferSeconds, counterOffsetSeconds });
  }

  async function destroy() {
    if (!confirmDestroy) {
      setConfirmDestroy(true);
      return;
    }
    if (await send("destroy", { type: "destroy" })) {
      updateDevice((data) => {
        const rooms = { ...data.rooms };
        delete rooms[room.code];
        return { ...data, rooms };
      });
      router.push(localePath(locale, "/tools/rally-sync"));
    }
  }

  const invalidTime = dict["sync.error.invalidTime"];
  const errorLine = (where: string, invalidText?: string) => {
    const error = errorFor(where);
    return error && <ErrorLine dict={dict} error={error} invalidText={invalidText} />;
  };

  return (
    <section className="card border-2 border-gold-strong/60 p-4 md:p-5" aria-labelledby="sync-coord-title">
      <h2 id="sync-coord-title" className="flex items-center gap-2 text-lg font-extrabold text-ink">
        <Crown className="size-5 text-gold-strong" aria-hidden />
        {dict["sync.coord.title"]}
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label={dict["sync.mode"]}>
        {(["rally", "counter"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={room.mode === mode}
            onClick={() => setMode(mode)}
            disabled={pending !== null}
            className={clsx("btn-sm min-w-0 justify-center wrap-break-word", room.mode === mode ? "btn-primary" : "btn-ghost")}
          >
            {mode === "rally" ? <Swords className="size-4 shrink-0" aria-hidden /> : <Shield className="size-4 shrink-0" aria-hidden />}
            {dict[`sync.mode.${mode}`]}
          </button>
        ))}
      </div>
      {errorLine("mode")}

      {room.mode === "rally" ? (
        <div className="mt-4 space-y-3">
          <button type="button" className="btn-gold w-full py-4 text-lg" onClick={() => void send("resync", { type: "resync" })} disabled={pending !== null}>
            <RefreshCw className={clsx("size-5", pending === "resync" && "motion-safe:animate-spin")} aria-hidden />
            {dict["sync.coord.resync"]}
          </button>
          <p className="text-xs text-ink-muted">
            {format(dict["sync.coord.resyncHint"], {
              wait: formatSeconds(room.rallyWaitSeconds),
              march: formatSeconds(longest),
              buffer: formatSeconds(room.bufferSeconds),
            })}
            {preview !== null && (
              <>
                {" "}
                <span className="font-bold text-ink tabular" dir="ltr">
                  ≈ {shown(preview)} {clock.label}
                </span>
              </>
            )}
          </p>
          {errorLine("resync")}
          <TimeForm
            id="sync-hit"
            label={format(dict["sync.coord.hitAt"], { clock: clock.label })}
            placeholder="14:30:00"
            submit={dict["sync.coord.set"]}
            pending={pending !== null}
            onSubmit={fieldSubmit("hit", (text) => ({ type: "hitClock", text }))}
          />
          {errorLine("hit", invalidTime)}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <TimeForm
            id="sync-enemy-in"
            label={dict["sync.coord.enemyIn"]}
            placeholder="4:32"
            submit={dict["sync.coord.set"]}
            pending={pending !== null}
            big
            onSubmit={fieldSubmit("enemyIn", (text) => ({ type: "enemyIn", text }))}
          />
          {errorLine("enemyIn", dict["sync.error.invalidDuration"])}
          <TimeForm
            id="sync-enemy-at"
            label={format(dict["sync.coord.enemyAt"], { clock: clock.label })}
            placeholder="14:30:00"
            submit={dict["sync.coord.set"]}
            pending={pending !== null}
            onSubmit={fieldSubmit("enemyAt", (text) => ({ type: "enemyClock", text }))}
          />
          {errorLine("enemyAt", invalidTime)}
          <p className="text-xs text-ink-muted">{format(dict["sync.coord.counterHint"], { offset: room.counterOffsetSeconds })}</p>
        </div>
      )}

      {late.length > 0 && (
        <p role="status" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {format(dict[room.mode === "counter" ? "sync.coord.lateCounter" : "sync.coord.late"], { names: late.map((l) => l.name).join(", ") })}
        </p>
      )}
      <button type="button" className="btn-ghost btn-sm mt-4" aria-expanded={more} onClick={() => setMore((v) => !v)}>
        <ChevronDown className={clsx("size-4 transition-transform", more && "rotate-180")} aria-hidden />
        {dict["sync.coord.more"]}
      </button>

      {more && (
      <div className="mt-3 space-y-2">
        <Disclosure title={dict["sync.coord.settings"]}>
          <form onSubmit={saveSettings} key={`${room.rallyWaitSeconds}-${room.bufferSeconds}-${room.counterOffsetSeconds}`} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberInput id="sync-wait" name="wait" label={dict["sync.coord.wait"]} defaultValue={formatSeconds(room.rallyWaitSeconds)} hint={dict["sync.coord.waitHint"]} />
              <NumberInput id="sync-buffer" name="buffer" label={dict["sync.coord.buffer"]} defaultValue={String(room.bufferSeconds)} hint={format(dict["sync.coord.bufferHint"], { max: MAX_BUFFER_SECONDS })} numeric />
              <NumberInput
                id="sync-offset"
                name="offset"
                label={dict["sync.coord.offset"]}
                defaultValue={String(room.counterOffsetSeconds)}
                hint={format(dict["sync.coord.offsetHint"], { max: MAX_COUNTER_OFFSET_SECONDS })}
                numeric
              />
            </div>
            {errorLine("settings", dict["sync.error.invalidSettings"])}
            <button type="submit" className="btn-primary btn-sm" disabled={pending !== null}>
              {dict["sync.save"]}
            </button>
          </form>
        </Disclosure>

        <Disclosure title={dict["sync.coord.addLeader"]}>
          <p className="mb-3 text-sm text-ink-muted">{dict["sync.coord.addLeaderHint"]}</p>
          <LeaderForm
            key={added}
            dict={dict}
            idPrefix="sync-add"
            defaults={{ name: "", marchSeconds: null }}
            submitLabel={dict["sync.coord.add"]}
            pending={pending !== null}
            error={errorFor("add")}
            onInvalid={() => fail("add", "invalid")}
            onSubmit={(input) =>
              void send("add", { type: "addLeader", ...input }).then((done) => {
                if (done) setAdded((n) => n + 1);
              })
            }
          />
        </Disclosure>

        <Disclosure title={dict["sync.invite.title"]}>
          <InvitePanel code={room.code} token={token} dict={dict} />
        </Disclosure>

        {room.history.length > 0 && (
          <Disclosure title={format(dict["sync.history"], { n: room.history.length })}>
            <ul className="space-y-1 text-sm text-ink-muted">
              {room.history.map((entry) => (
                <li key={`${entry.hitAt}-${entry.setAt}`} className="tabular" dir="ltr">
                  {shown(Date.parse(entry.hitAt))} {clock.label}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {room.hitAt && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => void send("clear", { type: "clearHit" })} disabled={pending !== null}>
            {dict["sync.coord.clear"]}
          </button>
        )}
        <button type="button" className={clsx("btn-sm", confirmDestroy ? "btn-primary bg-danger" : "btn-ghost text-danger")} onClick={() => void destroy()} disabled={pending !== null}>
          <Trash2 className="size-4" aria-hidden />
          {confirmDestroy ? dict["sync.coord.destroyConfirm"] : dict["sync.coord.destroy"]}
        </button>
        {confirmDestroy && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmDestroy(false)}>
            {dict["sync.cancel"]}
          </button>
        )}
      </div>
      {errorLine("destroy")}
      {errorLine("clear")}
      <p className="text-xs text-ink-faint">{format(dict["sync.closesNote"], { minutes: IDLE_CLOSE_MS / 60_000 })}</p>
      </div>
      )}
    </section>
  );
}

function TimeForm({
  id,
  label,
  placeholder,
  submit,
  pending,
  big,
  onSubmit,
}: {
  id: string;
  label: string;
  placeholder: string;
  submit: string;
  pending: boolean;
  big?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-md">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex gap-2">
        <input id={id} name="value" className={clsx("input", big && "text-2xl font-black")} placeholder={placeholder} autoComplete="off" inputMode="text" dir="ltr" />
        <button type="submit" className={clsx("shrink-0", big ? "btn-gold" : "btn-primary")} disabled={pending}>
          {submit}
        </button>
      </div>
    </form>
  );
}

function NumberInput({ id, name, label, defaultValue, hint, numeric }: { id: string; name: string; label: string; defaultValue: string; hint: string; numeric?: boolean }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">
        {label}
      </label>
      <input id={id} name={name} className="input" defaultValue={defaultValue} inputMode={numeric ? "numeric" : "text"} autoComplete="off" dir="ltr" />
      <p className="mt-1 text-xs text-ink-faint">{hint}</p>
    </div>
  );
}

function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card-soft group px-4 py-3">
      <summary className="cursor-pointer text-sm font-extrabold text-ink">
        <span className="me-1 inline-block transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden>
          ›
        </span>
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
