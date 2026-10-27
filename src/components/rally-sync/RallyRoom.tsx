"use client";

import clsx from "clsx";
import { ArrowLeft, Clock3, DoorClosed, Minus, MonitorSmartphone, Pencil, Plus, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { coordinate, joinRoom, leaveRoom, updateMyLeader } from "@/lib/rally-sync/actions";
import { NOTABLE_OFFSET_MS } from "@/lib/rally-sync/clock";
import { parseRoomHash, updateDevice, updateDeviceRoom } from "@/lib/rally-sync/device";
import type { LinkStatus } from "@/lib/rally-sync/realtime";
import { formatRoomCode, MAX_LEADERS_PER_ROOM, type RoomState } from "@/lib/rally-sync/room";
import { CuePlayer } from "@/lib/rally-sync/sound";
import { clampGameOffset, formatSeconds, isTooLate, MAX_GAME_OFFSET_SECONDS, withStartTimes } from "@/lib/rally-sync/timing";
import { CoordinatorPanel } from "./CoordinatorPanel";
import { useCorrectedSecond, useDevice, useRoomSync, useRunner, useWakeLock } from "./hooks";
import { type Clock, FocusBlock, isUrgent, LeaderRow, shown, type TimedLeaderView } from "./LeaderCards";
import { LeaderForm } from "./LeaderForm";

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

  // The password changed under us: the server shows the lock again.
  useEffect(() => {
    if (sync.ending === "locked") router.refresh();
  }, [sync.ending, router]);

  const hitAt = room.hitAt ? Date.parse(room.hitAt) : null;
  const hitSetAt = room.hitSetAt ? Date.parse(room.hitSetAt) : null;
  const timed = useMemo<TimedLeaderView[]>(() => withStartTimes(leaders, hitAt, room.rallyWaitSeconds), [leaders, hitAt, room.rallyWaitSeconds]);
  const myLeader = timed.find((l) => l.id === mine?.leader?.id) ?? null;
  const myStart = myLeader?.startAt ?? null;
  const myLate = myStart !== null && isTooLate(myStart, hitSetAt);

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
  useEffect(() => {
    if (now === null) return;
    player.current?.sync(device.sound && !myLate ? myStart : null, sync.offsetMs + gameOffsetMs);
  }, [now, device.sound, myStart, myLate, sync.offsetMs, gameOffsetMs]);
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

  const urgent = isUrgent(myLeader, room, now);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <StatusBar
        room={room}
        now={now}
        clock={clock}
        link={realtime ? sync.link : null}
        offsetMs={sync.offsetMs}
        sound={device.sound}
        soundReady={soundReady}
        wakeLock={device.wakeLock}
        dict={dict}
      />

      {/* Pinned under the site header (h-16 + border) in the last minute, wherever the page is scrolled. */}
      <div className={clsx(urgent && "sticky top-17 z-30")}>
        <FocusBlock me={myLeader} room={room} now={now} clock={clock} dict={dict} />
      </div>

      <MyEntry code={code} myLeader={myLeader} prominent={!coordinatorToken} dict={dict} onChanged={sync.refresh} />

      {coordinatorToken && <CoordinatorPanel room={room} leaders={timed} now={now} clock={clock} token={coordinatorToken} dict={dict} locale={locale} onChanged={sync.refresh} />}

      <LeaderList
        leaders={myLeader ? timed.filter((l) => l.id !== myLeader.id) : timed}
        others={myLeader !== null}
        now={now}
        room={room}
        coordinatorToken={coordinatorToken}
        dict={dict}
        onChanged={sync.refresh}
      />
    </div>
  );
}

const LINK_DOT: Record<LinkStatus, string> = { live: "bg-success", connecting: "bg-gold-strong", offline: "bg-danger" };

/** One slim line: which room, whether updates are live, the clock, and icon switches for sound, screen and the game clock. */
function StatusBar({
  room,
  now,
  clock,
  link,
  offsetMs,
  sound,
  soundReady,
  wakeLock,
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
  dict: Dictionary;
}) {
  const [clockOpen, setClockOpen] = useState(false);
  const canWakeLock = useSyncExternalStore(noSubscribe, () => "wakeLock" in navigator, () => false);
  const iconButton = "grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-card text-ink-muted hover:text-ink";

  return (
    <section className="card px-4 py-3">
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
              {dict[`sync.mode.${room.mode}`]} · {formatSeconds(room.rallyWaitSeconds)}
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
          <button type="button" className="me-1 text-end" onClick={() => setClockOpen((v) => !v)} aria-expanded={clockOpen} title={dict["sync.clockPanel.title"]}>
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
          <button
            type="button"
            className={iconButton}
            aria-pressed={sound}
            aria-label={sound ? dict["sync.sound.on"] : dict["sync.sound.off"]}
            title={sound ? dict["sync.sound.on"] : dict["sync.sound.off"]}
            onClick={() => updateDevice((d) => ({ ...d, sound: !d.sound }))}
          >
            {sound ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          </button>
          {canWakeLock && (
            <button
              type="button"
              className={clsx(iconButton, !wakeLock && "opacity-50")}
              aria-pressed={wakeLock}
              aria-label={wakeLock ? dict["sync.wake.on"] : dict["sync.wake.off"]}
              title={wakeLock ? dict["sync.wake.on"] : dict["sync.wake.off"]}
              onClick={() => updateDevice((d) => ({ ...d, wakeLock: !d.wakeLock }))}
            >
              <MonitorSmartphone className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
      {sound && !soundReady && <p className="mt-2 text-xs font-bold text-gold-ink">{dict["sync.sound.tap"]}</p>}
      {clockOpen && <ClockPanel now={now} clock={clock} offsetMs={offsetMs} dict={dict} />}
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
function MyEntry({ code, myLeader, prominent, dict, onChanged }: { code: string; myLeader: TimedLeaderView | null; prominent: boolean; dict: Dictionary; onChanged: () => void }) {
  const device = useDevice();
  const token = device.rooms[code]?.leader?.token ?? null;
  const { pending, run, errorFor, fail } = useRunner(onChanged);
  const [open, setOpen] = useState(false);

  if (!myLeader || !token) {
    if (!open) {
      return (
        <button type="button" className={clsx("w-full", prominent ? "btn-primary" : "btn-ghost btn-sm")} onClick={() => setOpen(true)}>
          {dict["sync.join.toggle"]}
        </button>
      );
    }
    return (
      <section className="card p-4 md:p-5">
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
          onInvalid={() => fail("join", "invalid")}
          onSubmit={(input) =>
            void run("join", async () => {
              const result = await joinRoom(code, input);
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
      <section className="flex items-center gap-3 rounded-card border-2 border-primary/50 bg-primary-soft px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black wrap-break-word text-ink" dir="auto">
            {myLeader.name}
            <span className="chip ms-2 bg-primary align-middle text-primary-ink">{dict["sync.you"]}</span>
          </p>
          <p className="text-sm font-semibold text-ink-muted">
            {dict["sync.march"]}{" "}
            <span className="tabular" dir="ltr">
              {formatSeconds(myLeader.marchSeconds)}
            </span>
          </p>
        </div>
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={() => setOpen(true)}>
          <Pencil className="size-4" aria-hidden />
          {dict["sync.edit"]}
        </button>
      </section>
    );
  }

  return (
    <section className="card p-4 md:p-5">
      <h2 className="text-base font-extrabold text-ink">{dict["sync.me.title"]}</h2>
      <p className="mt-1 mb-3 text-sm text-ink-muted">{dict["sync.me.hint"]}</p>
      <LeaderForm
        key={`${myLeader.name}-${myLeader.marchSeconds}`}
        dict={dict}
        idPrefix="sync-me"
        defaults={{ name: myLeader.name, marchSeconds: myLeader.marchSeconds }}
        submitLabel={dict["sync.save"]}
        pending={pending !== null}
        error={errorFor("me")}
        onInvalid={() => fail("me", "invalid")}
        onSubmit={(input) =>
          void run("me", async () => {
            const result = await updateMyLeader(code, myLeader.id, token, input);
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
    </section>
  );
}

/**
 * The other leaders (everyone, for a visitor who isn't leading). Quiet for
 * leaders, who only need their own time; the coordinator, who watches them
 * all, gets the stage colours and opens a row to edit it.
 */
function LeaderList({
  leaders,
  others,
  now,
  room,
  coordinatorToken,
  dict,
  onChanged,
}: {
  leaders: TimedLeaderView[];
  others: boolean;
  now: number | null;
  room: RoomState["room"];
  coordinatorToken: string | null;
  dict: Dictionary;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const { pending, run, errorFor, fail } = useRunner(onChanged);

  return (
    <section aria-labelledby="sync-leaders-title">
      <h2 id="sync-leaders-title" className="mb-2 px-1 text-xs font-bold tracking-wider text-ink-faint uppercase">
        {others ? dict["sync.leaders.others"] : dict["sync.leaders.title"]}{" "}
        <span className="tabular">{others ? `(${leaders.length})` : `(${leaders.length}/${MAX_LEADERS_PER_ROOM})`}</span>
      </h2>
      {leaders.length === 0 ? (
        others ? null : (
        <p className="card-soft px-4 py-3 text-sm font-semibold text-ink-muted">{dict["sync.leaders.empty"]}</p>
        )
      ) : (
        <ul className={clsx("divide-y divide-line overflow-hidden", coordinatorToken ? "card" : "card-soft")}>
          {leaders.map((leader) => (
            <li key={leader.id}>
              {coordinatorToken && editing === leader.id ? (
                <div className="p-4">
                  <LeaderForm
                    dict={dict}
                    idPrefix={`sync-edit-${leader.id}`}
                    defaults={{ name: leader.name, marchSeconds: leader.marchSeconds }}
                    submitLabel={dict["sync.save"]}
                    pending={pending !== null}
                    error={errorFor(leader.id)}
                    onInvalid={() => fail(leader.id, "invalid")}
                    onSubmit={(input) =>
                      void run(leader.id, () => coordinate(room.code, coordinatorToken, { type: "editLeader", leaderId: leader.id, ...input })).then((done) => {
                        if (done) setEditing(null);
                      })
                    }
                  >
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>
                      {dict["sync.cancel"]}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-danger"
                      disabled={pending !== null}
                      onClick={() =>
                        void run(leader.id, () => coordinate(room.code, coordinatorToken, { type: "removeLeader", leaderId: leader.id })).then((done) => {
                          if (done) setEditing(null);
                        })
                      }
                    >
                      {dict["sync.remove"]}
                    </button>
                  </LeaderForm>
                </div>
              ) : (
                <LeaderRow leader={leader} now={now} room={room} quiet={!coordinatorToken} dict={dict} onEdit={coordinatorToken ? () => setEditing(leader.id) : undefined} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
