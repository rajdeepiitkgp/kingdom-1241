// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { DoorOpen } from "lucide-react";
import { useActionState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { unlockRoom, type UnlockRoomState } from "@/lib/rally-sync/actions";
import { formatRoomCode } from "@/lib/rally-sync/room";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";

const INITIAL: UnlockRoomState = { status: "idle" };

/**
 * Room ID + password. On the Rally Sync page both are typed; on a locked room
 * the ID is fixed. A correct password sets the room cookie and the action
 * redirects into the room.
 */
export function JoinRoomForm({ dict, locale, fixedCode }: { dict: Dictionary; locale: string; fixedCode?: string }) {
  const [state, formAction, pending] = useActionState(unlockRoom, INITIAL);
  const now = useNow(1000);
  const waitMs = state.error === "throttled" && state.retryAt && now ? Math.max(0, state.retryAt - now.getTime()) : 0;
  const waiting = state.error === "throttled" && (now === null || waitMs > 0);
  const error =
    state.status !== "error" || !state.error
      ? null
      : state.error === "throttled"
        ? waiting
          ? format(dict["sync.error.throttled"], { time: now ? formatDuration(waitMs, dict, true) : "…" })
          : null
        : dict[`sync.error.${state.error}`];
  const hint = state.error === "wrong" && state.triesLeft !== undefined && state.triesLeft <= 2 ? format(dict["kvk.triesLeft"], { n: state.triesLeft }) : null;

  return (
    <form action={formAction} className="card p-5 md:p-6">
      <h2 className="text-xl font-extrabold text-ink">{fixedCode ? dict["sync.unlock.title"] : dict["sync.join.title"]}</h2>
      <p className="mt-1 text-sm text-ink-muted">{fixedCode ? dict["sync.unlock.body"] : dict["sync.join.body"]}</p>
      <input type="hidden" name="locale" value={locale} />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fixedCode ? (
          <div className="min-w-0">
            <input type="hidden" name="code" value={fixedCode} />
            <p className="label">{dict["sync.roomId"]}</p>
            <p className="input text-ink-muted" dir="ltr">
              {formatRoomCode(fixedCode)}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <label htmlFor="sync-code" className="label">
              {dict["sync.roomId"]}
            </label>
            <input
              id="sync-code"
              name="code"
              className="input uppercase"
              placeholder="K7M 4QX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={9}
              required
              dir="ltr"
            />
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor="sync-password" className="label">
            {dict["kvk.password"]}
          </label>
          <input
            id="sync-password"
            name="password"
            type="password"
            className="input"
            autoComplete="off"
            required
            dir="ltr"
            disabled={waiting}
            aria-invalid={state.error === "wrong"}
            aria-describedby={error ? "sync-join-error" : undefined}
          />
        </div>
      </div>
      {error && (
        <p id="sync-join-error" role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger" suppressHydrationWarning>
          {error}
          {hint && <span className="mt-1 block font-semibold">{hint}</span>}
        </p>
      )}
      <button type="submit" className="btn-primary mt-4 w-full sm:w-auto" disabled={pending || waiting}>
        <DoorOpen className="size-4" aria-hidden />
        {dict["sync.join.submit"]}
      </button>
    </form>
  );
}
