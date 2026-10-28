"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import type { KvkArea } from "@/lib/kvk/access";
import { unlockChecklist, unlockKvk, unlockLeaders, type UnlockState } from "@/lib/kvk/actions";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";

const INITIAL: UnlockState = { status: "idle" };

/** Each locked page has its own password, checked by its own action. */
const ACTIONS = { plan: unlockKvk, leaders: unlockLeaders, checklist: unlockChecklist } satisfies Record<KvkArea, unknown>;
const TEXTS = {
  plan: { body: "kvk.locked.body", unavailable: "kvk.unavailable" },
  leaders: { body: "leaders.locked.body", unavailable: "leaders.unavailable" },
  checklist: { body: "checklist.locked.body", unavailable: "checklist.unavailable" },
} as const satisfies Record<KvkArea, unknown>;

/** Password form. On success the Server Action sets the cookie and the page re-renders unlocked. */
export function UnlockCard({ dict, area = "plan" }: { dict: Dictionary; area?: KvkArea }) {
  const [state, formAction, pending] = useActionState(ACTIONS[area], INITIAL);
  const now = useNow(1000);
  // After too many wrong passwords the server names a moment; the form waits for it with a countdown.
  const waitMs = state.status === "throttled" && state.retryAt && now ? Math.max(0, state.retryAt - now.getTime()) : 0;
  const waiting = state.status === "throttled" && (now === null || waitMs > 0);
  const error =
    state.status === "wrong"
      ? dict["kvk.wrongPassword"]
      : state.status === "unavailable"
        ? dict[TEXTS[area].unavailable]
        : waiting
          ? format(dict["kvk.throttled"], { time: now ? formatDuration(waitMs, dict, true) : "…" })
          : null;
  const hint =
    state.status === "wrong" && state.triesLeft !== undefined && state.triesLeft <= 2
      ? state.triesLeft === 1
        ? dict["kvk.triesLeftOne"]
        : format(dict["kvk.triesLeft"], { n: state.triesLeft })
      : null;

  return (
    <form action={formAction} className="card mx-auto max-w-md p-6 text-center md:p-8" data-tour="kvk-unlock">
      <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-gold text-on-gold shadow-[0_4px_0_0_var(--gold-strong)]" aria-hidden>
        <LockKeyhole className="size-8" />
      </span>
      <h2 className="mt-4 text-xl font-black text-ink">{dict["kvk.locked.title"]}</h2>
      <p className="mt-1 text-sm font-semibold text-ink-muted">{dict[TEXTS[area].body]}</p>

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
        disabled={waiting}
        aria-invalid={state.status === "wrong"}
        aria-describedby={error ? "kvk-password-error" : undefined}
      />
      {error && (
        <p id="kvk-password-error" role="alert" className="mt-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-bold text-danger" suppressHydrationWarning>
          {error}
          {hint && <span className="mt-1 block font-semibold">{hint}</span>}
        </p>
      )}
      <button type="submit" className="btn-primary mt-4 w-full" disabled={pending || waiting}>
        <KeyRound className="size-4" aria-hidden />
        {dict["kvk.unlock"]}
      </button>
    </form>
  );
}
