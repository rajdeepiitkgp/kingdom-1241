"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { unlockKvk, type UnlockState } from "@/lib/kvk/actions";

const INITIAL: UnlockState = { status: "idle" };

/** Password form. On success the Server Action sets the cookie and the page re-renders unlocked. */
export function UnlockCard({ dict }: { dict: Dictionary }) {
  const [state, formAction, pending] = useActionState(unlockKvk, INITIAL);
  const error =
    state.status === "wrong" ? dict["kvk.wrongPassword"] : state.status === "unavailable" ? dict["kvk.unavailable"] : null;

  return (
    <form action={formAction} className="card mx-auto max-w-md p-6 text-center md:p-8">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-gold text-on-gold shadow-[0_4px_0_0_var(--gold-strong)]" aria-hidden>
        <LockKeyhole className="size-8" />
      </span>
      <h2 className="mt-4 text-xl font-black text-ink">{dict["kvk.locked.title"]}</h2>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{dict["kvk.locked.body"]}</p>

      <label htmlFor="kvk-password" className="label mt-5 text-start">
        {dict["kvk.password"]}
      </label>
      <input
        id="kvk-password"
        name="password"
        type="password"
        className="input"
        autoComplete="current-password"
        required
        autoFocus
        dir="ltr"
        aria-invalid={state.status === "wrong"}
        aria-describedby={error ? "kvk-password-error" : undefined}
      />
      {error && (
        <p id="kvk-password-error" role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary mt-4 w-full" disabled={pending}>
        <KeyRound className="size-4" aria-hidden />
        {dict["kvk.unlock"]}
      </button>
    </form>
  );
}
