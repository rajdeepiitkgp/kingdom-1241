// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { Crown, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { IDLE_STATE } from "@/lib/admin/action-state";
import { createRallyRoom, type CreateRoomState, destroyRallyRoom, reissueCoordinatorLink, type ReissueState } from "@/lib/admin/rally-sync-actions";
import type { AdminRallyRoom } from "@/lib/admin/rally-sync-data";
import { localePath } from "@/lib/i18n/paths";
import { coordinatorLinkPath, inviteLinkPath, updateDevice, updateDeviceRoom } from "@/lib/rally-sync/device";
import { formatRoomCode, MAX_OPEN_ROOMS, PASSWORD_MAX, PASSWORD_MIN, ROOM_MODES, type RoomMode, TITLE_MAX } from "@/lib/rally-sync/room";
import { formatSeconds, parseDuration } from "@/lib/rally-sync/timing";
import { formatUtcTime } from "@/lib/time";
import { useDevice } from "../rally-sync/hooks";
import { Field, Notice } from "./ui";

const MODE_LABELS: Record<RoomMode, string> = { rally: "Rally (we attack)", counter: "Counter-rally (land right after the enemy)" };

/**
 * The admin Rally Sync page: create a room, see the open ones, destroy one or
 * hand out a new coordinator link. Secrets of a new room are shown once and
 * kept on this device (coordinator token, invite key, password), so "Open as
 * coordinator" works right away; the settings are remembered for the next room.
 */
export function RallySyncAdmin({ rooms, locale }: { rooms: AdminRallyRoom[]; locale: string }) {
  const openCount = rooms.filter((r) => r.open).length;
  return (
    <div className="space-y-5">
      <CreateRoomForm locale={locale} full={openCount >= MAX_OPEN_ROOMS} />
      <section className="space-y-3">
        <h2 className="text-lg font-extrabold text-ink">
          Rooms ({openCount}/{MAX_OPEN_ROOMS} open)
        </h2>
        {rooms.length === 0 ? (
          <p className="rounded-xl bg-card-soft px-4 py-3 text-sm font-semibold text-ink-muted">No rooms yet.</p>
        ) : (
          <ul className="space-y-3">
            {rooms.map((room) => (
              <RoomRow key={room.id} room={room} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CreateRoomForm({ locale, full }: { locale: string; full: boolean }) {
  const device = useDevice();
  const last = device.lastSettings;
  const [state, formAction, pending] = useActionState(async (previous: CreateRoomState, formData: FormData) => {
    const result = await createRallyRoom(previous, formData);
    if (result.created) {
      const created = result.created;
      updateDeviceRoom(created.code, (room) => ({ ...room, coordinator: created.coordinatorToken, invite: created.inviteKey, password: created.password, title: created.title }));
      const mode = formData.get("mode") === "counter" ? "counter" : "rally";
      updateDevice((data) => ({
        ...data,
        lastSettings: {
          mode,
          rallyWaitSeconds: parseDuration(String(formData.get("rallyWait") ?? "")) ?? data.lastSettings.rallyWaitSeconds,
          bufferSeconds: Number(formData.get("buffer")) || 0,
          counterOffsetSeconds: Number(formData.get("offset")) || 0,
        },
      }));
    }
    return result;
  }, IDLE_STATE as CreateRoomState);
  const errors = state.errors ?? {};

  return (
    <section className="card p-5">
      <h2 className="text-lg font-extrabold text-ink">New room</h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">The settings can be changed in the room later. This device remembers them for the next room.</p>
      <form action={formAction} key={JSON.stringify(last)} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Title (optional, shown to players after they open the room)" htmlFor="rs-title" error={errors.title}>
            <input id="rs-title" name="title" className="input" maxLength={TITLE_MAX} placeholder="Castle — first wave" autoComplete="off" />
          </Field>
          <Field label={`Password (${PASSWORD_MIN}+ characters)`} htmlFor="rs-password" error={errors.password} hint="Share it with the room ID, or send the invite link instead.">
            <input id="rs-password" name="password" className="input" minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} required autoComplete="off" />
          </Field>
          <Field label="Mode" htmlFor="rs-mode">
            <select id="rs-mode" name="mode" className="input select-chevron" defaultValue={last.mode}>
              {ROOM_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rally timer (minutes:seconds)" htmlFor="rs-wait" error={errors.rallyWait} hint="The in-game rally wait, usually 5:00.">
            <input id="rs-wait" name="rallyWait" className="input" defaultValue={formatSeconds(last.rallyWaitSeconds)} autoComplete="off" />
          </Field>
          <Field label="Buffer for Re-sync (seconds)" htmlFor="rs-buffer" error={errors.buffer} hint="Extra time on top of the longest march; 0 is allowed.">
            <input id="rs-buffer" name="buffer" className="input" inputMode="numeric" defaultValue={last.bufferSeconds} autoComplete="off" />
          </Field>
          <Field label="Counter-rally offset (seconds after the enemy)" htmlFor="rs-offset" error={errors.offset} hint="0 to 10, usually 3.">
            <input id="rs-offset" name="offset" className="input" inputMode="numeric" defaultValue={last.counterOffsetSeconds} autoComplete="off" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary btn-sm" disabled={pending || full}>
            Create room
          </button>
          {full && <p className="text-sm font-bold text-danger">{MAX_OPEN_ROOMS} rooms are open. Destroy one below first.</p>}
        </div>
        <Notice state={state} />
      </form>
      {state.created && <CreatedRoom created={state.created} locale={locale} />}
    </section>
  );
}

function CreatedRoom({ created, locale }: { created: NonNullable<CreateRoomState["created"]>; locale: string }) {
  const origin = window.location.origin;
  return (
    <div className="mt-5 space-y-3 rounded-2xl border-2 border-success bg-success-soft p-4">
      <p className="font-extrabold text-ink">Room {formatRoomCode(created.code)} is open. Copy what you need now: the password and links are not shown again.</p>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Secret label="Room ID" value={formatRoomCode(created.code)} />
        <Secret label="Password" value={created.password} />
        <Secret label="Invite link (opens the room directly)" value={`${origin}${inviteLinkPath(created.code, created.inviteKey)}`} wide />
        <Secret label="Coordinator link (only for whoever runs the room)" value={`${origin}${coordinatorLinkPath(created.code, created.inviteKey, created.coordinatorToken)}`} wide />
      </dl>
      <Link href={`${localePath(locale, `/tools/rally-sync/${created.code}`)}#k=${created.inviteKey}`} className="btn-gold btn-sm">
        <Crown className="size-4" aria-hidden />
        Open as coordinator
      </Link>
    </div>
  );
}

function Secret({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="label">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="input min-w-0 flex-1 text-sm break-all" dir="ltr">
          {value}
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm shrink-0"
          onClick={() =>
            void navigator.clipboard.writeText(value).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </dd>
    </div>
  );
}

function RoomRow({ room, locale }: { room: AdminRallyRoom; locale: string }) {
  const device = useDevice();
  const isCoordinatorHere = Boolean(device.rooms[room.code]?.coordinator);
  const [destroyState, destroyAction, destroying] = useActionState(destroyRallyRoom, IDLE_STATE);
  const [reissueState, reissueAction, reissuing] = useActionState(async (previous: ReissueState, formData: FormData) => {
    const result = await reissueCoordinatorLink(previous, formData);
    if (result.link) {
      const link = result.link;
      updateDeviceRoom(link.code, (r) => ({ ...r, coordinator: link.coordinatorToken, invite: link.inviteKey }));
    }
    return result;
  }, IDLE_STATE as ReissueState);

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-extrabold text-ink">
            <span dir="ltr">{formatRoomCode(room.code)}</span>
            {room.title && <span className="wrap-break-word">{room.title}</span>}
            {room.open ? <span className="chip bg-success-soft text-success">Open</span> : <span className="chip bg-card-soft text-ink-muted">Closed</span>}
            <span className="chip bg-card-soft text-ink-muted">{room.mode === "counter" ? "Counter-rally" : "Rally"}</span>
            {isCoordinatorHere && <span className="chip bg-gold-soft text-gold-ink">Coordinator on this device</span>}
          </p>
          <p className="text-sm text-ink-muted">
            {room.leaderCount} leader{room.leaderCount === 1 ? "" : "s"} · created by {room.createdByName ?? "—"} · {utc(room.createdAt)} · last activity {utc(room.lastSeenAt)}
            {room.open && ` · closes ${utc(room.closesAt)} if nobody opens it`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {room.open && (
            <Link href={localePath(locale, `/tools/rally-sync/${room.code}`)} className="btn-ghost btn-sm">
              <ExternalLink className="size-4" aria-hidden />
              Open
            </Link>
          )}
          {room.open && (
            <form action={reissueAction}>
              <input type="hidden" name="id" value={room.id} />
              <button type="submit" className="btn-ghost btn-sm" disabled={reissuing}>
                New coordinator link
              </button>
            </form>
          )}
          <form
            action={destroyAction}
            onSubmit={(event) => {
              if (!window.confirm(`Destroy room ${room.code}? Everyone in it is sent out.`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={room.id} />
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn-ghost btn-sm text-danger" disabled={destroying}>
              Destroy
            </button>
          </form>
        </div>
      </div>
      <Notice state={destroyState} className="mt-3" />
      {reissueState.link ? (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
          <Secret label="New coordinator link (the old one no longer works)" value={`${window.location.origin}${coordinatorLinkPath(reissueState.link.code, reissueState.link.inviteKey, reissueState.link.coordinatorToken)}`} wide />
        </dl>
      ) : (
        <Notice state={reissueState} className="mt-3" />
      )}
    </li>
  );
}

/** "14:02 UTC" (the page renders on the server too, so always UTC). */
const utc = (iso: string) => formatUtcTime(new Date(iso));
