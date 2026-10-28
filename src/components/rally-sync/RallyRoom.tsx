// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { ArrowLeft, Clock3, DoorClosed, Minus, MonitorSmartphone, Pencil, Plus, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { joinRoom, leaveRoom, renameMe, setMyActive, updateMyLeader } from "@/lib/rally-sync/actions";
import { NOTABLE_OFFSET_MS } from "@/lib/rally-sync/clock";
import { counterOrder } from "@/lib/rally-sync/counter";
import { parseRoomHash, updateDevice, updateDeviceRoom } from "@/lib/rally-sync/device";
import { currentWave, playerPlan, refillCues } from "@/lib/rally-sync/garrison";
import type { LinkStatus } from "@/lib/rally-sync/realtime";
import {
  formatRoomCode,
  type InstanceSelf,
  NAME_MAX,
  nextRallyMarch,
  parseInstanceName,
  rallyRunning,
  type RoomState,
} from "@/lib/rally-sync/room";
import { CuePlayer } from "@/lib/rally-sync/sound";
import { clampGameOffset, formatSeconds, isTooLate, MAX_GAME_OFFSET_SECONDS, soundCues, withStartTimes } from "@/lib/rally-sync/timing";
import { RALLY_SYNC_TOURS } from "@/lib/rally-sync/tours";
import { resolveSteps } from "@/lib/tour/tour";
import { tourLabels, useGuidedTour } from "../tour/GuidedTour";
import { CoordinatorPanel } from "./CoordinatorPanel";
import { CounterFocus, CounterSheet } from "./Counter";
import { GarrisonBoard } from "./Garrison";
import { useCorrectedSecond, useDevice, useRoomSync, useRunner, useWakeLock } from "./hooks";
import { type Clock, FocusBlock, isUrgent, LeaderRow, NextMarch, shown, type TimedLeaderView } from "./LeaderCards";
import { ErrorLine, LeaderForm } from "./LeaderForm";
import { LeaderList } from "./LeaderList";

const noSubscribe = () => () => {};

/**
 * A Rally Sync room for a visitor who unlocked it. Built to be calm: one slim
 * status line, one big block with the visitor's own start time (it becomes
 * the countdown), their own entry as a highlighted card, and the other
 * leaders as quiet rows below. Everything time-related
 * is computed from stored timestamps on every tick of the corrected clock, so
 * a tab coming back from the background is right at once. This device's role
 * (leader of a row, coordinator) comes from its localStorage tokens.
 */
export function RallyRoom({ initial, realtime, dict, locale }: { initial: RoomState; realtime: { url: string; key: string } | null; dict: Dictionary; locale: string }) {
  const code = initial.room.code;
  const router = useRouter();
  const sync = useRoomSync(code, initial, realtime);
  const device = useDevice();
  // "now" is this device's game clock: the server-corrected clock plus the player's adjustment. Stored times are game times.
  const gameOffsetMs = device.gameOffsetSeconds * 1000;
  const now = useCorrectedSecond(sync.offsetMs + gameOffsetMs);
  const mine = device.rooms[code];
  const coordinatorToken = mine?.coordinator ?? null;
  const { room, leaders } = sync.state;
  const clock: Clock = { offsetSeconds: device.gameOffsetSeconds, label: device.gameOffsetSeconds ? dict["sync.gameClock"] : "UTC" };

  // An invite or coordinator link opened while the room was already unlocked (also pasted into this tab): keep its keys, clean the address bar.
  useEffect(() => {
    const takeHash = () => {
      const { invite, coordinator } = parseRoomHash(window.location.hash);
      updateDeviceRoom(code, (r) => ({ ...r, ...(invite ? { invite } : {}), ...(coordinator ? { coordinator } : {}) }));
      if (invite || coordinator) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    takeHash();
    window.addEventListener("hashchange", takeHash);
    return () => window.removeEventListener("hashchange", takeHash);
  }, [code]);

  useEffect(() => {
    if (room.title) updateDeviceRoom(code, (r) => (r.title === room.title ? r : { ...r, title: room.title }));
  }, [code, room.title]);

  // The coordinator removed this browser (or an old cookie met a new password): the server shows the lock again.
  useEffect(() => {
    if (sync.ending === "locked") router.refresh();
  }, [sync.ending, router]);

  const hitAt = room.hitAt ? Date.parse(room.hitAt) : null;
  const hitSetAt = room.hitSetAt ? Date.parse(room.hitSetAt) : null;
  const timed = useMemo<TimedLeaderView[]>(() => withStartTimes(leaders, hitAt, room.rallyWaitSeconds), [leaders, hitAt, room.rallyWaitSeconds]);
  const myLeader = timed.find((l) => l.id === mine?.leader?.id) ?? null;
  const myStart = myLeader?.startAt ?? null;
  const myLate = myStart !== null && isTooLate(myStart, hitSetAt);

  // Garrison rooms: this player's refills, worked out here from the room's enemy hits and their own march time.
  const garrison = room.mode === "garrison";
  const { marchSeconds: garrisonMarch, spacingSeconds } = device.garrison;
  const plan = useMemo(
    () => (garrison && now !== null ? playerPlan(room.garrison, now, garrisonMarch, spacingSeconds) : null),
    [garrison, room.garrison, now, garrisonMarch, spacingSeconds],
  );
  // Counter rooms: the launch order, slowest march first (nothing about it ticks).
  const counter = room.mode === "counter";
  const counterSteps = counter ? counterOrder(leaders, room.rallyWaitSeconds) : [];
  // A tap's exact moment on this device's game clock (the coordinator marks enemy rallies with it).
  const exactNow = useCallback(() => Date.now() + sync.offsetMs + gameOffsetMs, [sync.offsetMs, gameOffsetMs]);

  // Sound: unlocked by the first tap (browsers require one), then cues are booked on the audio clock.
  const player = useRef<CuePlayer | null>(null);
  const [soundReady, setSoundReady] = useState(false);
  useEffect(() => {
    if (!device.sound) return;
    const unlock = () => {
      player.current ??= new CuePlayer();
      player.current.unlock();
      window.setTimeout(() => setSoundReady(player.current?.unlocked ?? false), 100);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [device.sound]);
  // A leader's own start, or a garrison player's sends and speedups (the player rebooks only when the moments change).
  const cues = !device.sound ? null : garrison ? (plan ? refillCues(plan.steps) : null) : myStart !== null && !myLate ? soundCues(myStart) : null;
  useEffect(() => {
    if (now === null) return;
    player.current?.sync(cues, sync.offsetMs + gameOffsetMs);
  }, [now, cues, sync.offsetMs, gameOffsetMs]);
  useEffect(() => () => player.current?.cancel(), []);

  useWakeLock(device.wakeLock);

  if (sync.ending === "closed") {
    return (
      <div className="card mx-auto max-w-md px-5 py-8 text-center">
        <DoorClosed className="mx-auto size-10 text-ink-faint" aria-hidden />
        <h2 className="mt-3 text-xl font-black text-ink">{dict["sync.closed.title"]}</h2>
        <p className="mt-1 text-sm text-ink-muted">{dict["sync.closed.body"]}</p>
        <Link href={localePath(locale, "/tools/rally-sync")} className="btn-primary mt-5">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {dict["sync.back"]}
        </Link>
      </div>
    );
  }

  const statusBar = (
    <StatusBar
      room={room}
      now={now}
      clock={clock}
      link={realtime ? sync.link : null}
      offsetMs={sync.offsetMs}
      sound={device.sound}
      soundReady={soundReady}
      wakeLock={device.wakeLock}
      quietTour={now !== null && (garrison ? currentWave(room.garrison.rallies, now).length > 0 : rallyRunning(room.hitAt, now))}
      dict={dict}
    />
  );
  const coordinatorPanel = coordinatorToken && (
    <CoordinatorPanel
      room={room}
      leaders={timed}
      now={now}
      clock={clock}
      token={coordinatorToken}
      dict={dict}
      locale={locale}
      version={sync.updatedAt}
      exactNow={exactNow}
      leaderLimit={sync.state.leaderLimit}
      onChanged={sync.refresh}
    />
  );

  // A garrison room: no leaders and no list of who is in, only the coordinator's marking and each player's own refills.
  if (garrison) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {statusBar}
        {coordinatorPanel}
        <GarrisonBoard plan={plan} now={now} clock={clock} dict={dict} />
      </div>
    );
  }

  const myEntry = (
    <MyEntry
      code={code}
      me={sync.state.me}
      myLeader={myLeader}
      prominent={!coordinatorToken}
      runningHitAt={now !== null && rallyRunning(room.hitAt, now) ? room.hitAt : null}
      clock={clock}
      leaderLimit={sync.state.leaderLimit}
      dict={dict}
      onChanged={sync.refresh}
    />
  );
  const browserName = !myLeader && sync.state.me && <BrowserName code={code} me={sync.state.me} leaderName={null} dict={dict} onChanged={sync.refresh} />;

  // A counter-rally room: the leader's own place in the order, big, then the whole order. No hit time, countdown or sound.
  if (counter) {
    const myStep = counterSteps.find((s) => s.leader.id === myLeader?.id);
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {statusBar}
        {myStep && <CounterFocus step={myStep} dict={dict} />}
        {myEntry}
        {browserName}
        {coordinatorPanel}
        <CounterSheet
          steps={counterSteps}
          leaders={leaders}
          myId={myLeader?.id ?? null}
          rallyWaitSeconds={room.rallyWaitSeconds}
          code={code}
          coordinatorToken={coordinatorToken}
          gameOffsetSeconds={clock.offsetSeconds}
          dict={dict}
          onChanged={sync.refresh}
        />
      </div>
    );
  }

  const urgent = isUrgent(myLeader, room, now);
  const others = myLeader ? timed.filter((l) => l.id !== myLeader.id) : timed;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {statusBar}

      {/* Pinned under the site header (h-16 + border) in the last minute, wherever the page is scrolled. */}
      <div className={clsx(urgent && "sticky top-17 z-30")} data-tour="sync-focus">
        <FocusBlock me={myLeader} room={room} now={now} clock={clock} dict={dict} />
      </div>

      {myEntry}

      {browserName}

      {coordinatorPanel}

      <div data-tour="sync-leaders">
        <LeaderList
          leaders={others}
          title={
            <>
              {myLeader ? dict["sync.leaders.others"] : dict["sync.leaders.title"]}{" "}
              <span className="tabular">{myLeader ? `(${others.length})` : `(${others.length}/${sync.state.leaderLimit})`}</span>
            </>
          }
          empty={myLeader ? null : dict["sync.leaders.empty"]}
          code={code}
          coordinatorToken={coordinatorToken}
          gameOffsetSeconds={clock.offsetSeconds}
          dict={dict}
          onChanged={sync.refresh}
          row={(leader, onEdit) => <LeaderRow leader={leader} now={now} room={room} quiet={!coordinatorToken} dict={dict} onEdit={onEdit} />}
        />
      </div>
    </div>
  );
}

const LINK_DOT: Record<LinkStatus, string> = { live: "bg-success", connecting: "bg-gold-strong", offline: "bg-danger" };

/**
 * How the coordinator's list shows this browser, with a small form to rename it.
 * A watcher shows as "Watcher K7M4" until it names itself; a leader's browser shows
 * as the leader unless it is renamed (a proxy running the entry for someone else),
 * and that line sits inside the leader's edit card, out of the way.
 */
function BrowserName({
  code,
  me,
  leaderName,
  dict,
  onChanged,
}: {
  code: string;
  me: InstanceSelf;
  /** The browser's own leader entry, if it has one. */
  leaderName: string | null;
  dict: Dictionary;
  onChanged: () => void;
}) {
  const { pending, run, errorFor, fail } = useRunner(onChanged);
  const [editing, setEditing] = useState(false);
  const tagLabel = format(dict["sync.instances.watcher"], { tag: me.tag });
  const shownName = me.name ?? leaderName ?? tagLabel;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = parseInstanceName(new FormData(event.currentTarget).get("name"));
    if (!name.ok) return fail("name", "invalid");
    if (await run("name", () => renameMe(code, name.value))) setEditing(false);
  }

  if (!editing) {
    return (
      <p className={clsx("text-sm text-ink-muted", leaderName === null && "text-center")}>
        {format(dict[leaderName === null ? "sync.watching" : "sync.device.leaderLine"], { name: shownName })}{" "}
        <button type="button" className="font-bold text-primary underline" onClick={() => setEditing(true)}>
          {me.name || leaderName !== null ? dict["sync.edit"] : dict["sync.watching.set"]}
        </button>
      </p>
    );
  }
  return (
    <form onSubmit={(event) => void save(event)} className={clsx(leaderName === null && "card-soft px-4 py-3")}>
      <label htmlFor="sync-my-name" className="label">
        {dict[leaderName === null ? "sync.watching.label" : "sync.device.label"]}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="sync-my-name"
          name="name"
          className="input min-w-0 flex-1 basis-40"
          defaultValue={me.name ?? ""}
          placeholder={leaderName ?? undefined}
          maxLength={NAME_MAX}
          autoComplete="off"
          dir="auto"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={pending !== null}>
          {dict["sync.save"]}
        </button>
        <button type="button" className="btn-ghost shrink-0" onClick={() => setEditing(false)}>
          {dict["sync.cancel"]}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-faint">{leaderName === null ? format(dict["sync.watching.hint"], { tag: tagLabel }) : dict["sync.device.leaderHint"]}</p>
      {errorFor("name") && <ErrorLine dict={dict} error={errorFor("name") ?? "failed"} />}
    </form>
  );
}

/**
 * One slim line: which room, whether updates are live, the clock, icon switches
 * for sound, screen and the game clock, and the "?" of the room's guided tour
 * (its "New here?" line stays away while a rally runs or enemy rallies come in).
 */
function StatusBar({
  room,
  now,
  clock,
  link,
  offsetMs,
  sound,
  soundReady,
  wakeLock,
  quietTour,
  dict,
}: {
  room: RoomState["room"];
  now: number | null;
  clock: Clock;
  link: LinkStatus | null;
  offsetMs: number;
  sound: boolean;
  soundReady: boolean;
  wakeLock: boolean;
  quietTour: boolean;
  dict: Dictionary;
}) {
  const [clockOpen, setClockOpen] = useState(false);
  const roomTour = RALLY_SYNC_TOURS[room.mode];
  const tour = useGuidedTour(roomTour, resolveSteps(roomTour, dict), tourLabels(dict), { quiet: quietTour });
  const canWakeLock = useSyncExternalStore(noSubscribe, () => "wakeLock" in navigator, () => false);
  const iconButton = "grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-card text-ink-muted hover:text-ink";

  return (
    <section className="card px-4 py-3" data-tour="sync-status">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="font-extrabold wrap-break-word text-ink" dir="auto">
            {room.title || dict["sync.untitled"]}
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-ink-muted">
            <span className="tabular" dir="ltr">
              {formatRoomCode(room.code)}
            </span>
            <span aria-hidden>·</span>
            <span>
              {dict[`sync.mode.${room.mode}`]}
              {room.mode !== "garrison" && ` · ${formatSeconds(room.rallyWaitSeconds)}`}
            </span>
            {link && (
              <span className="inline-flex items-center gap-1">
                <span className={clsx("size-2 rounded-full", LINK_DOT[link], link === "live" && "motion-safe:animate-pulse")} aria-hidden />
                {dict[`sync.link.${link}`]}
              </span>
            )}
          </p>
        </div>
        <div className="ms-auto flex items-center gap-1.5">
          <button type="button" className="me-1 text-end" onClick={() => setClockOpen((v) => !v)} aria-expanded={clockOpen} title={dict["sync.clockPanel.title"]} data-tour="sync-clock">
            <span className="block text-xl/tight font-black text-ink tabular" dir="ltr">
              {now === null ? "--:--:--" : shown(now)}
            </span>
            <span className={clsx("block text-[0.6875rem] font-bold", clock.offsetSeconds ? "text-gold-ink" : "text-ink-faint")}>
              {clock.offsetSeconds ? format(dict["sync.clockPanel.offset"], { s: signed(clock.offsetSeconds) }) : "UTC"}
            </span>
          </button>
          <button
            type="button"
            className={clsx(iconButton, clockOpen && "text-ink")}
            aria-expanded={clockOpen}
            aria-label={dict["sync.clockPanel.title"]}
            title={dict["sync.clockPanel.title"]}
            onClick={() => setClockOpen((v) => !v)}
          >
            <Clock3 className="size-4" aria-hidden />
          </button>
          {room.mode !== "counter" && (
          <button
            type="button"
            className={iconButton}
            aria-pressed={sound}
            data-tour="sync-sound"
            aria-label={sound ? dict["sync.sound.on"] : dict["sync.sound.off"]}
            title={sound ? dict["sync.sound.on"] : dict["sync.sound.off"]}
            onClick={() => updateDevice((d) => ({ ...d, sound: !d.sound }))}
          >
            {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          </button>
          )}
          {canWakeLock && (
            <button
              type="button"
              className={clsx(iconButton, !wakeLock && "opacity-50")}
              aria-pressed={wakeLock}
              data-tour="sync-wake"
              aria-label={wakeLock ? dict["sync.wake.on"] : dict["sync.wake.off"]}
              title={wakeLock ? dict["sync.wake.on"] : dict["sync.wake.off"]}
              onClick={() => updateDevice((d) => ({ ...d, wakeLock: !d.wakeLock }))}
            >
              <MonitorSmartphone className="size-4" aria-hidden />
            </button>
          )}
          {tour.button}
        </div>
      </div>
      {tour.nudge && <div className="mt-2">{tour.nudge}</div>}
      {sound && !soundReady && room.mode !== "counter" && <p className="mt-2 text-xs font-bold text-gold-ink">{dict["sync.sound.tap"]}</p>}
      {clockOpen && <ClockPanel now={now} clock={clock} offsetMs={offsetMs} dict={dict} />}
      {tour.overlay}
    </section>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/**
 * The game-clock adjustment: the player compares the seconds here with the
 * game's clock and nudges until they tick together. Stored per device.
 */
function ClockPanel({ now, clock, offsetMs, dict }: { now: number | null; clock: Clock; offsetMs: number; dict: Dictionary }) {
  const set = (value: number) => updateDevice((d) => ({ ...d, gameOffsetSeconds: clampGameOffset(value) }));
  const offset = clock.offsetSeconds;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-sm font-extrabold text-ink">{dict["sync.clockPanel.title"]}</p>
      <p className="mt-1 text-xs text-ink-muted">{dict["sync.clockPanel.body"]}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2" dir="ltr">
          <button type="button" className="btn-ghost btn-sm" onClick={() => set(offset - 1)} disabled={offset <= -MAX_GAME_OFFSET_SECONDS} aria-label={dict["sync.clockPanel.earlier"]}>
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="min-w-28 text-center text-2xl font-black text-ink tabular">{now === null ? "--:--:--" : shown(now)}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => set(offset + 1)} disabled={offset >= MAX_GAME_OFFSET_SECONDS} aria-label={dict["sync.clockPanel.later"]}>
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
        <span className="text-sm font-bold text-ink-muted tabular">{offset ? format(dict["sync.clockPanel.offset"], { s: signed(offset) }) : dict["sync.clockPanel.none"]}</span>
        {offset !== 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => set(0)}>
            {dict["sync.clockPanel.reset"]}
          </button>
        )}
      </div>
      {Math.abs(offsetMs) >= NOTABLE_OFFSET_MS && (
        <p className="mt-2 text-xs text-ink-faint">{format(dict[offsetMs > 0 ? "sync.clock.behind" : "sync.clock.ahead"], { s: (Math.abs(offsetMs) / 1000).toFixed(1) })}</p>
      )}
    </div>
  );
}

/**
 * One line for the visitor's own entry (opens to edit or remove it; the
 * coordinator's own entry is managed here too, as it isn't in the list
 * below); a single button to join for everyone else. Removing the entry
 * keeps the visitor in the room.
 */
function MyEntry({
  code,
  me,
  myLeader,
  prominent,
  runningHitAt,
  clock,
  leaderLimit,
  dict,
  onChanged,
}: {
  code: string;
  /** This browser as the coordinator's list shows it (null for a cookie from before instances). */
  me: InstanceSelf | null;
  myLeader: TimedLeaderView | null;
  prominent: boolean;
  /** The hit time while a rally is running (changes then wait for the next rally), else null. */
  runningHitAt: string | null;
  clock: Clock;
  /** The room's leader limit, for "this room is full". */
  leaderLimit: number;
  dict: Dictionary;
  onChanged: () => void;
}) {
  const device = useDevice();
  const token = device.rooms[code]?.leader?.token ?? null;
  const { pending, run, errorFor, fail } = useRunner(onChanged);
  const [open, setOpen] = useState(false);
  const setActive = (active: boolean) =>
    run("me", async () => {
      if (!myLeader || !token) return { ok: false as const, error: "not_yours" as const };
      const result = await setMyActive(code, myLeader.id, token, active, clock.offsetSeconds);
      if (result.ok) setOpen(false);
      return result;
    });

  if (!myLeader || !token) {
    if (!open) {
      return (
        <button type="button" className={clsx("w-full", prominent ? "btn-primary" : "btn-ghost btn-sm")} onClick={() => setOpen(true)} data-tour="sync-me">
          {dict["sync.join.toggle"]}
        </button>
      );
    }
    return (
      <section className="card p-4 md:p-5" data-tour="sync-me">
        <h2 className="text-base font-extrabold text-ink">{dict["sync.join.leader"]}</h2>
        <p className="mt-1 mb-3 text-sm text-ink-muted">{dict["sync.join.leaderHint"]}</p>
        <LeaderForm
          key={device.profile ? "profile" : "empty"}
          dict={dict}
          idPrefix="sync-me"
          defaults={{ name: device.profile?.name ?? "", marchSeconds: device.profile?.marchSeconds ?? null }}
          submitLabel={dict["sync.join.leaderSubmit"]}
          pending={pending !== null}
          error={errorFor("join")}
          leaderLimit={leaderLimit}
          onInvalid={() => fail("join", "invalid")}
          onSubmit={(input) =>
            void run("join", async () => {
              const result = await joinRoom(code, input, clock.offsetSeconds);
              if (result.ok) {
                updateDeviceRoom(code, (r) => ({ ...r, leader: { id: result.leaderId, token: result.token } }));
                updateDevice((d) => ({ ...d, profile: { name: input.name, marchSeconds: input.marchSeconds } }));
                setOpen(false);
              }
              return result;
            })
          }
        >
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
            {dict["sync.cancel"]}
          </button>
        </LeaderForm>
      </section>
    );
  }

  if (!open) {
    return (
      <section className="flex items-center gap-3 rounded-card border-2 border-primary/50 bg-primary-soft px-4 py-3" data-tour="sync-me">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black wrap-break-word text-ink" dir="auto">
            {myLeader.name}
            <span className="chip ms-2 bg-primary align-middle text-primary-ink">{dict["sync.you"]}</span>
            {myLeader.status !== "active" && (
              <span className="chip ms-1 bg-card align-middle text-ink-muted">{dict[myLeader.status === "inactive" ? "sync.row.inactive" : "sync.row.nextRally"]}</span>
            )}
          </p>
          <p className="text-sm font-semibold text-ink-muted">
            {dict["sync.march"]}{" "}
            <span className="tabular" dir="ltr">
              {formatSeconds(myLeader.marchSeconds)}
            </span>
            <NextMarch leader={myLeader} dict={dict} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Coming back is one tap (it never moves a running rally); sitting out sits in the form, so it can't happen by accident. */}
          {myLeader.status === "inactive" && (
            <button type="button" className="btn-primary btn-sm" onClick={() => void setActive(true)} disabled={pending !== null}>
              {dict["sync.backIn"]}
            </button>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
            <Pencil className="size-4" aria-hidden />
            {dict["sync.edit"]}
          </button>
        </div>
      </section>
    );
  }

  const inRunningRally = runningHitAt !== null && myLeader.status === "active";

  return (
    <section className="card p-4 md:p-5" data-tour="sync-me">
      <h2 className="text-base font-extrabold text-ink">{dict["sync.me.title"]}</h2>
      {inRunningRally ? (
        <p className="mt-2 mb-3 rounded-xl bg-gold-soft px-3 py-2 text-sm font-semibold text-gold-ink">
          {format(dict["sync.me.running"], { time: `${shown(Date.parse(runningHitAt))} ${clock.label}`, march: formatSeconds(myLeader.marchSeconds) })}
        </p>
      ) : (
        <p className="mt-1 mb-3 text-sm text-ink-muted">{dict["sync.me.hint"]}</p>
      )}
      <LeaderForm
        key={`${myLeader.name}-${myLeader.marchSeconds}-${myLeader.nextMarchSeconds}`}
        dict={dict}
        idPrefix="sync-me"
        defaults={{ name: myLeader.name, marchSeconds: nextRallyMarch(myLeader) }}
        submitLabel={dict["sync.save"]}
        pending={pending !== null}
        error={errorFor("me")}
        onInvalid={() => fail("me", "invalid")}
        onSubmit={(input) =>
          void run("me", async () => {
            const result = await updateMyLeader(code, myLeader.id, token, input, clock.offsetSeconds);
            if (result.ok) {
              updateDevice((d) => ({ ...d, profile: { name: input.name, marchSeconds: input.marchSeconds } }));
              setOpen(false);
            }
            return result;
          })
        }
      >
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
          {dict["sync.cancel"]}
        </button>
        {myLeader.status !== "inactive" && (
          <button type="button" className="btn-ghost btn-sm" disabled={pending !== null} onClick={() => void setActive(false)}>
            {dict["sync.sitOut"]}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost btn-sm text-danger"
          disabled={pending !== null}
          onClick={() =>
            void run("me", async () => {
              const result = await leaveRoom(code, myLeader.id, token);
              if (result.ok) {
                updateDeviceRoom(code, (r) => {
                  const next = { ...r };
                  delete next.leader;
                  return next;
                });
                setOpen(false);
              }
              return result;
            })
          }
        >
          {dict["sync.me.remove"]}
        </button>
      </LeaderForm>
      {runningHitAt !== null && myLeader.status !== "inactive" && <p className="mt-2 text-xs text-ink-faint">{dict["sync.me.sitOutRunning"]}</p>}
      {me && (
        <div className="mt-4 border-t border-line pt-3">
          <BrowserName code={code} me={me} leaderName={myLeader.name} dict={dict} onChanged={onChanged} />
        </div>
      )}
    </section>
  );
}
