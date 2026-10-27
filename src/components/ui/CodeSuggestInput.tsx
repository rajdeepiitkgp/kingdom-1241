"use client";

import clsx from "clsx";
import { Dices } from "lucide-react";
import { type ComponentProps, type ReactNode, useRef } from "react";
import { randomDigits } from "@/lib/random-code";

/**
 * A shared-password field with a button that fills in a random six-digit code
 * and selects it, ready to copy into Discord. The field stays a normal,
 * uncontrolled input: forms read it through FormData as before. `children`
 * (e.g. the form's submit button) share the row and wrap with it.
 */
export function CodeSuggestInput({
  suggestLabel,
  suggestHint,
  children,
  className,
  ...input
}: ComponentProps<"input"> & { suggestLabel: string; suggestHint: string; children?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);

  function suggest() {
    const field = ref.current;
    if (!field) return;
    field.value = randomDigits();
    field.focus();
    field.select();
  }

  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <input ref={ref} {...input} className={clsx("input min-w-0 flex-1 basis-40", className)} />
      <button type="button" className="btn-ghost shrink-0" onClick={suggest} title={suggestHint}>
        <Dices className="size-5" aria-hidden />
        {suggestLabel}
      </button>
      {children}
    </div>
  );
}
