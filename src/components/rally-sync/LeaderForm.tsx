"use client";

import type { FormEvent, ReactNode } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import type { LeaderInput, SyncError } from "@/lib/rally-sync/actions";
import { MAX_LEADERS_PER_ROOM, MAX_LEADERS_TOTAL, NAME_MAX, parseMarch, parseName } from "@/lib/rally-sync/room";

/**
 * In-game name + march time. Seconds is the main field (that's what the game
 * shows); minutes is optional for long marches, and both add up.
 */
export function LeaderForm({
  dict,
  idPrefix,
  defaults,
  submitLabel,
  pending,
  error,
  onSubmit,
  onInvalid,
  children,
}: {
  dict: Dictionary;
  idPrefix: string;
  defaults: { name: string; marchSeconds: number | null };
  submitLabel: string;
  pending: boolean;
  error: SyncError | null;
  onSubmit: (input: LeaderInput) => void;
  onInvalid: () => void;
  children?: ReactNode;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = parseName(data.get("name"));
    const march = parseMarch(data.get("seconds"), data.get("minutes"));
    if (!name.ok || !march.ok) onInvalid();
    else onSubmit({ name: name.value, marchSeconds: march.value });
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-name`} className="label">
            {dict["sync.form.name"]}
          </label>
          <input id={`${idPrefix}-name`} name="name" className="input" defaultValue={defaults.name} maxLength={NAME_MAX} autoComplete="nickname" required dir="auto" />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-seconds`} className="label">
            {dict["sync.form.marchSeconds"]}
          </label>
          <input
            id={`${idPrefix}-seconds`}
            name="seconds"
            className="input"
            defaultValue={defaults.marchSeconds ?? ""}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="42"
            autoComplete="off"
            required
            dir="ltr"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${idPrefix}-minutes`} className="label">
            {dict["sync.form.marchMinutes"]}
          </label>
          <input id={`${idPrefix}-minutes`} name="minutes" className="input" inputMode="numeric" pattern="[0-9]*" placeholder="0" autoComplete="off" dir="ltr" />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-faint">{dict["sync.form.marchHint"]}</p>
      {error && <ErrorLine dict={dict} error={error} invalidText={dict["sync.error.invalidLeader"]} />}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn-primary btn-sm" disabled={pending}>
          {submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
}

/** An action's error in the player's language; `invalidText` says what was wrong with this particular form. */
export function ErrorLine({ dict, error, invalidText }: { dict: Dictionary; error: SyncError; invalidText?: string }) {
  const text =
    error === "invalid"
      ? (invalidText ?? dict["sync.error.invalid"])
      : error === "leader_limit"
        ? format(dict["sync.error.leader_limit"], { n: MAX_LEADERS_PER_ROOM })
        : error === "total_limit"
          ? format(dict["sync.error.total_limit"], { n: MAX_LEADERS_TOTAL })
          : dict[`sync.error.${error}`];
  return (
    <p role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
      {text}
    </p>
  );
}
