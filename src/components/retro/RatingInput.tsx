"use client";

import clsx from "clsx";
import { Star } from "lucide-react";
import { useState } from "react";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { RATING_MAX, RATING_MIN } from "@/lib/retro/questions";

/**
 * One rating question: a radio group from 0 (a small "0" pill) to 5 stars.
 * Real radio inputs underneath, so the keyboard (arrow keys), the form reset
 * and the native "required" check all work; the stars are only the skin.
 */
export function RatingInput({
  name,
  label,
  hint,
  required,
  error,
  dict,
}: {
  name: string;
  label: string;
  hint: string;
  required: boolean;
  error: string | null;
  dict: Dictionary;
}) {
  const [value, setValue] = useState<number | null>(null);
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const values = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

  return (
    <fieldset
      className={clsx("rounded-2xl bg-card-soft p-3 sm:p-4", error && "ring-2 ring-danger/60")}
      aria-describedby={error ? errorId : hintId}
      aria-invalid={error ? true : undefined}
      onReset={() => setValue(null)}
    >
      <legend className="float-start mb-2 w-full">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-base font-extrabold text-ink" dir="auto">
            {label}
          </span>
          <span className={clsx("chip", required ? "bg-gold-soft text-gold-ink" : "bg-card text-ink-faint")}>
            {required ? dict["retro.required"] : dict["retro.optional"]}
          </span>
        </span>
        <span id={hintId} className="mt-0.5 block text-sm font-semibold text-ink-muted" dir="auto">
          {hint}
        </span>
      </legend>
      {/* Six equal cells that share the row's width (one row at every viewport and text size); the value label sits at the end or wraps below. */}
      <div className="clear-both flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="grid max-w-80 grow basis-52 grid-cols-6 gap-1" dir="ltr">
          {values.map((n) => {
            const selected = value !== null && n <= value;
            const isZero = n === RATING_MIN;
            return (
              <label
                key={n}
                className={clsx(
                  "relative grid aspect-square w-full cursor-pointer place-items-center rounded-xl transition-colors",
                  "has-focus-visible:ring-4 has-focus-visible:ring-primary/40",
                  isZero && (value === 0 ? "bg-danger-soft text-danger" : "bg-card text-ink-faint hover:text-ink-muted"),
                  !isZero && (selected ? "text-gold-strong" : "text-ink-faint/60 hover:text-ink-faint"),
                )}
                title={format(dict["retro.stars"], { n })}
              >
                <input
                  type="radio"
                  name={name}
                  value={n}
                  required={required}
                  className="sr-only"
                  onChange={() => setValue(n)}
                  aria-label={format(dict["retro.stars"], { n })}
                />
                {isZero ? (
                  <span className="text-sm font-black tabular">0</span>
                ) : (
                  <Star className={clsx("size-[70%]", selected && "fill-current")} strokeWidth={selected ? 1.75 : 2} aria-hidden />
                )}
              </label>
            );
          })}
        </div>
        <span className="ms-auto min-w-10 text-sm font-black text-ink tabular" aria-live="polite" dir="auto">
          {value === null ? "" : format(dict["retro.stars"], { n: value })}
        </span>
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-xs font-bold text-danger" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
