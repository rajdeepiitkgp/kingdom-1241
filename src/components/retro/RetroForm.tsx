"use client";

import clsx from "clsx";
import { BadgeCheck, CircleCheck, LoaderCircle, Send } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { lookupGovernor, submitRetro, type LookupState, type SubmitState } from "@/lib/retro/actions";
import { FIELD, isGovernorId, NO_ALLIANCE, normalizeGovernorId, type RetroErrorCode } from "@/lib/retro/form";
import { GAME_NAME_MAX, type RetroConfig, shownRatings, shownTexts, TEXT_MAX, type TextKey } from "@/lib/retro/questions";
import { formatDuration } from "../time/DurationLabel";
import { useNow } from "../time/useNow";
import { RatingInput } from "./RatingInput";

/**
 * The feedback form. Uncontrolled fields (so a reset works), one Server
 * Action for the Governor ID check while typing and one for the submission.
 * The device remembers a sent answer in localStorage so the player sees the
 * thank-you instead of the form again.
 */

const INITIAL: SubmitState = { status: "idle" };
const DONE_EVENT = "kd1241:retro-done";
const doneKey = (retroId: string) => `kd1241_retro_done_${retroId}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(DONE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DONE_EVENT, onChange);
  };
}

function readDone(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markDone(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode / storage blocked: the thank-you still shows for this visit.
  }
  window.dispatchEvent(new Event(DONE_EVENT));
}

export function RetroForm({
  retroId,
  config,
  alliances,
  kingdom,
  lookupEnabled,
  dict,
  locale,
}: {
  retroId: string;
  config: RetroConfig;
  alliances: Array<{ tag: string; name: string }>;
  kingdom: number;
  lookupEnabled: boolean;
  dict: Dictionary;
  locale: string;
}) {
  const [state, formAction, pending] = useActionState(submitRetro, INITIAL);
  // Submitted by hand inside a transition: React resets an uncontrolled form after
  // a plain `action` submission, which would wipe the player's text when the server
  // refuses the answer (wrong id, duplicate, throttled). The browser's own
  // "required" checks still run before onSubmit fires.
  const [, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => formAction(data));
  };
  const key = doneKey(retroId);
  const storedDone = useSyncExternalStore(subscribe, () => readDone(key), () => false);
  useEffect(() => {
    if (state.status === "ok") markDone(key);
  }, [state.status, key]);

  // Governor ID check while typing (MightPulse through the server; silent when it can't answer).
  // MightPulse may still be fetching a player it hasn't seen for a while, so a timed-out
  // lookup is retried a few seconds later, up to twice, as long as the id is unchanged.
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const currentId = useRef("");
  // Name and alliance are controlled so a late answer can fill them in without remounting
  // the inputs (the player may be typing in them): no frozen fields, no lost cursor.
  const [gameName, setGameName] = useState("");
  const [alliance, setAlliance] = useState("");
  const knownAlliance = (tag: string | null | undefined) => (tag && alliances.some((a) => a.tag === tag) ? tag : null);
  const [checking, startLookup] = useTransition();
  const check = (raw: string, attempt = 0) => {
    const id = normalizeGovernorId(raw);
    if (!lookupEnabled || !isGovernorId(id)) return;
    if (attempt === 0 && id === currentId.current) return; // already checked, or being checked
    currentId.current = id;
    startLookup(async () => {
      const result = await lookupGovernor(id);
      if (currentId.current !== id) return; // the player changed the id meanwhile
      setLookup(result);
      if (result.status === "found") {
        setGameName(result.name ?? "");
        const known = knownAlliance(result.allianceTag);
        if (known) setAlliance(known);
      }
      if (result.status === "skipped" && result.retry && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (currentId.current === id) check(id, attempt + 1);
      }
    });
  };
  const found = lookup.status === "found";
  // The alliance stays editable when MightPulse names one the site doesn't list yet (the server honours the pick).
  const allianceLocked = found && knownAlliance(lookup.allianceTag) !== null;

  const [lengths, setLengths] = useState<Partial<Record<TextKey, number>>>({});
  const now = useNow(1000);
  const waitMs = state.status === "throttled" && state.retryAt && now ? Math.max(0, state.retryAt - now.getTime()) : 0;
  const waiting = state.status === "throttled" && (now === null || waitMs > 0);

  if (storedDone || state.status === "ok") {
    return (
      <section className="card p-6 text-center md:p-8" aria-live="polite" data-tour="retro-done">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-success-soft text-success" aria-hidden>
          <CircleCheck className="size-9" />
        </span>
        <h2 className="mt-4 text-xl font-black text-ink">{dict["retro.thanks.title"]}</h2>
        <p className="mt-1 text-sm font-semibold text-ink-muted">{dict["retro.thanks.body"]}</p>
      </section>
    );
  }

  const errors = state.status === "invalid" ? (state.errors ?? {}) : {};
  const errorText = (code: RetroErrorCode | undefined, max?: number): string | null => {
    if (!code) return null;
    if (code === "tooLong") return format(dict["retro.error.tooLong"], { max: max ?? TEXT_MAX });
    return dict[`retro.error.${code}`];
  };
  const governorError =
    state.status === "unknownGovernor" || lookup.status === "unknown"
      ? format(dict["retro.lookup.unknown"], { kingdom })
      : errorText(errors[FIELD.governorId]);
  const notice =
    state.status === "invalid"
      ? dict["retro.error.fix"]
      : state.status === "duplicate"
        ? dict["retro.error.duplicate"]
        : state.status === "closed"
          ? dict["retro.closed"]
          : state.status === "full"
            ? dict["retro.full"]
            : state.status === "unknownGovernor"
              ? format(dict["retro.lookup.unknown"], { kingdom })
              : waiting
                ? format(dict["retro.error.throttled"], { time: now ? formatDuration(waitMs, dict, true) : "…" })
                : state.status === "unavailable"
                  ? dict["retro.error.unavailable"]
                  : null;
  const closed = state.status === "closed" || state.status === "full";

  return (
    <form action={formAction} onSubmit={submit} className="space-y-6">
      <input type="hidden" name={FIELD.retroId} value={retroId} />
      <input type="hidden" name={FIELD.locale} value={locale} />
      {found && lookup.token && <input type="hidden" name={FIELD.token} value={lookup.token} />}
      {/* Honeypot: people never see it, bots fill it. */}
      <div className="hidden" aria-hidden>
        <label>
          Website <input type="text" name={FIELD.honeypot} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <section className="card space-y-4 p-5" data-tour="retro-you">
        <h2 className="text-lg font-extrabold text-ink">{dict["retro.you"]}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1 sm:col-span-2">
            <label htmlFor="retro-governor" className="label mb-0">
              {dict["retro.governorId"]} <span className="chip ms-1 bg-gold-soft text-gold-ink">{dict["retro.required"]}</span>
            </label>
            <div className="relative">
              <input
                id="retro-governor"
                name={FIELD.governorId}
                className={clsx("input pe-12", governorError && "border-danger")}
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9 .\\-_]{4,24}"
                required
                maxLength={20}
                dir="ltr"
                onBlur={(event) => check(event.target.value)}
                onChange={(event) => {
                  if (normalizeGovernorId(event.target.value) !== currentId.current) {
                    currentId.current = "";
                    setLookup({ status: "idle" });
                  }
                }}
                aria-invalid={governorError ? true : undefined}
                aria-describedby={governorError ? "retro-governor-error" : "retro-governor-hint"}
              />
              {checking && <LoaderCircle className="absolute inset-y-0 inset-e-4 my-auto size-5 animate-spin text-ink-faint" aria-hidden />}
              {found && !checking && <BadgeCheck className="absolute inset-y-0 inset-e-4 my-auto size-5 text-success" aria-hidden />}
            </div>
            {governorError ? (
              <p id="retro-governor-error" className="text-xs font-bold text-danger" role="alert">
                {governorError}
              </p>
            ) : found ? (
              <p className="text-xs font-bold text-success" role="status">
                {format(dict["retro.lookup.found"], { name: lookup.name ?? "" })}
              </p>
            ) : checking ? (
              <p className="text-xs font-semibold text-ink-faint" role="status">
                {dict["retro.lookup.checking"]}
              </p>
            ) : (
              <p id="retro-governor-hint" className="text-xs font-semibold text-ink-faint">
                {dict["retro.governorId.hint"]}
              </p>
            )}
          </div>

          {/* With a confirmed id the name and alliance come from the game; the fields stay visible but locked. */}
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="retro-name" className="label mb-0">
              {dict["retro.name"]}
            </label>
            <input
              id="retro-name"
              name={FIELD.gameName}
              className={clsx("input", errors[FIELD.gameName] && "border-danger", found && "text-ink-muted")}
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              readOnly={found}
              required={!found}
              maxLength={GAME_NAME_MAX}
              autoComplete="nickname"
              dir="auto"
              aria-invalid={errors[FIELD.gameName] ? true : undefined}
            />
            {errorText(errors[FIELD.gameName], GAME_NAME_MAX) && <p className="text-xs font-bold text-danger">{errorText(errors[FIELD.gameName], GAME_NAME_MAX)}</p>}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="retro-alliance" className="label mb-0">
              {dict["retro.alliance"]}
            </label>
            <select
              id="retro-alliance"
              name={FIELD.alliance}
              className={clsx("input select-chevron", errors[FIELD.alliance] && "border-danger", allianceLocked && "pointer-events-none text-ink-muted")}
              value={alliance}
              onChange={(event) => setAlliance(event.target.value)}
              required
              tabIndex={allianceLocked ? -1 : undefined}
              aria-readonly={allianceLocked || undefined}
              aria-invalid={errors[FIELD.alliance] ? true : undefined}
            >
              <option value="" disabled>
                {dict["retro.alliance.choose"]}
              </option>
              {alliances.map((a) => (
                <option key={a.tag} value={a.tag}>
                  [{a.tag}] {a.name}
                </option>
              ))}
              <option value={NO_ALLIANCE}>{dict["retro.alliance.none"]}</option>
            </select>
            {errorText(errors[FIELD.alliance]) && <p className="text-xs font-bold text-danger">{errorText(errors[FIELD.alliance])}</p>}
          </div>
        </div>
        <p className="text-xs font-semibold text-ink-faint">{dict["retro.privacy"]}</p>
      </section>

      {shownRatings(config).length > 0 && (
        <section className="card space-y-3 p-5" data-tour="retro-ratings">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-extrabold text-ink">{dict["retro.ratings"]}</h2>
            <p className="text-xs font-bold text-ink-faint" dir="ltr">
              {dict["retro.scale"]}
            </p>
          </div>
          {shownRatings(config).map((q) => (
            <RatingInput
              key={q.key}
              name={FIELD.rating(q.key)}
              label={dict[q.labelKey]}
              hint={dict[q.hintKey]}
              required={config.ratings[q.key].required}
              error={errorText(errors[FIELD.rating(q.key)])}
              dict={dict}
            />
          ))}
        </section>
      )}

      {shownTexts(config).length > 0 && (
        <section className="card space-y-4 p-5" data-tour="retro-texts">
          <div>
            <h2 className="text-lg font-extrabold text-ink">{dict["retro.texts"]}</h2>
            <p className="mt-1 text-sm font-semibold text-ink-muted">{format(dict["retro.texts.hint"], { max: TEXT_MAX })}</p>
          </div>
          {shownTexts(config).map((t) => {
            const name = FIELD.text(t.key);
            const required = config.texts[t.key].required;
            const error = errorText(errors[name]);
            const id = `retro-${t.key}`;
            return (
              <div key={t.key} className="flex min-w-0 flex-col gap-1">
                <label htmlFor={id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-base font-extrabold text-ink" dir="auto">
                    {dict[t.labelKey]}
                  </span>
                  <span className={clsx("chip", required ? "bg-gold-soft text-gold-ink" : "bg-card-soft text-ink-faint")}>
                    {required ? dict["retro.required"] : dict["retro.optional"]}
                  </span>
                </label>
                <p id={`${id}-hint`} className="text-sm font-semibold text-ink-muted" dir="auto">
                  {dict[t.hintKey]}
                </p>
                <textarea
                  id={id}
                  name={name}
                  className={clsx("input min-h-28", error && "border-danger")}
                  maxLength={TEXT_MAX}
                  required={required}
                  dir="auto"
                  onChange={(event) => setLengths((prev) => ({ ...prev, [t.key]: event.target.value.length }))}
                  aria-describedby={error ? `${id}-error` : `${id}-hint`}
                  aria-invalid={error ? true : undefined}
                />
                <div className="flex items-baseline justify-between gap-3">
                  {error ? (
                    <p id={`${id}-error`} className="text-xs font-bold text-danger" role="alert">
                      {error}
                    </p>
                  ) : (
                    <span />
                  )}
                  <span className={clsx("text-xs font-bold tabular", (lengths[t.key] ?? 0) >= TEXT_MAX ? "text-danger" : "text-ink-faint")} dir="ltr">
                    {lengths[t.key] ?? 0} / {TEXT_MAX}
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {notice && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-danger" suppressHydrationWarning>
          {notice}
        </p>
      )}

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end" data-tour="retro-send">
        <button type="submit" className="btn-primary" disabled={pending || waiting || closed}>
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Send className="size-5 rtl:-scale-x-100" aria-hidden />}
          {/* Text in its own element: browser translation replaces bare text nodes, and React's icon swap must not depend on them. */}
          <span>{pending ? dict["retro.sending"] : dict["retro.submit"]}</span>
        </button>
      </div>
    </form>
  );
}
