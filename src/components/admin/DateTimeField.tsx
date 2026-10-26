"use client";

import { CalendarClock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNow } from "@/components/time/useNow";
import { Field } from "./ui";

const UTC_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const LOCAL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

/**
 * A UTC date-time field: the native picker (still the best one on phones)
 * dressed up, with a live preview of the chosen moment in UTC and in the
 * viewer's own time zone. The input stays uncontrolled so a form reset
 * (“Discard changes”) restores it; the preview follows through events.
 */
export function DateTimeField({
  id,
  name,
  label,
  defaultValue,
  hint,
  error,
  allowPast = false,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  hint: string;
  error?: string;
  /** For times that may lie behind us (the end of a battle that is over): no minimum, no warning. */
  allowPast?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  // null until hydrated: the local-time preview must never be server-rendered.
  const now = useNow(60_000);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const onReset = () => setValue(defaultValue);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [defaultValue]);

  const ms = value ? Date.parse(`${value}Z`) : Number.NaN;
  const valid = !Number.isNaN(ms);
  const past = !allowPast && valid && now !== null && ms < now.getTime();
  // The picker greys out the past, except for an old plan whose stored time
  // already lies behind us (it must stay saveable; the server allows an unchanged past time).
  const storedMs = defaultValue ? Date.parse(`${defaultValue}Z`) : Number.NaN;
  const storedInPast = !Number.isNaN(storedMs) && now !== null && storedMs < now.getTime();
  const min = now && !storedInPast && !allowPast ? now.toISOString().slice(0, 16) : undefined;
  const clear = () => {
    if (input.current) input.current.value = "";
    setValue("");
  };

  return (
    <Field label={label} htmlFor={id} error={error} hint={valid ? undefined : hint}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <CalendarClock className="pointer-events-none absolute inset-y-0 inset-s-4 my-auto size-5 text-ink-faint" aria-hidden />
          <input
            ref={input}
            id={id}
            name={name}
            type="datetime-local"
            step={60}
            min={min}
            defaultValue={defaultValue}
            onChange={(event) => setValue(event.target.value)}
            className="input ps-12 dark:scheme-dark"
          />
        </div>
        {value && (
          <button type="button" onClick={clear} className="btn-ghost btn-sm shrink-0">
            Clear
          </button>
        )}
      </div>
      {valid && (
        <p className={past ? "text-xs font-bold text-danger" : "text-xs font-semibold text-ink-muted"} aria-live="polite">
          {UTC_FORMAT.format(ms)} UTC
          {now && <> · {LOCAL_FORMAT.format(ms)} where you are</>}
          {past && <> · already in the past</>}
        </p>
      )}
    </Field>
  );
}
