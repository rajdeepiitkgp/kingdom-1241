// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { KeyRound, X } from "lucide-react";
import { useRef, useState } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { UnlockCard } from "./UnlockCard";

/**
 * The locked state of the council's plan on the prep page: one slim row where
 * the plan will be, with a button that opens the battle plan's password form
 * in a popup, so the public page gives the form no room of its own. A right
 * password sets the cookie and the page re-renders with the plan (this row
 * goes away, popup and all); a wrong one shows its message inside the popup.
 * Where the browser has no `<dialog>` with `showModal`, the form opens under
 * the row instead (every browser, or hidden, never the error page).
 */
export function PrepUnlock({ dict }: { dict: Dictionary }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [inline, setInline] = useState(false);

  const open = () => {
    const element = dialog.current;
    if (element && typeof element.showModal === "function") {
      try {
        element.showModal();
        return;
      } catch {
        // Falls through to the inline form.
      }
    }
    setInline(true);
  };
  const close = () => {
    try {
      dialog.current?.close();
    } catch {
      // Nothing to close.
    }
  };

  return (
    <section id="prep-council" className="scroll-mt-24" aria-label={dict["prep.council.title"]}>
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-3 border-2 border-dashed border-line p-4" data-tour="prep-unlock">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-xl" aria-hidden>
          🔑
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-xs font-bold tracking-wider text-ink-muted uppercase">{dict["prep.council.title"]}</p>
          <p className="text-sm font-semibold wrap-break-word text-ink">{dict["prep.council.locked"]}</p>
        </div>
        {!inline && (
          <button type="button" className="btn-primary btn-sm" onClick={open}>
            <KeyRound className="size-4" aria-hidden /> {dict["prep.council.open"]}
          </button>
        )}
      </div>

      {inline && (
        <div className="mt-4">
          <UnlockCard dict={dict} title="prep.council.title" body="prep.council.locked" />
        </div>
      )}

      {/* A click on the backdrop (the dialog itself, outside the card) closes it; Escape does by itself. */}
      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border-0 bg-transparent p-0 text-ink backdrop:bg-black/60"
        aria-label={dict["prep.council.title"]}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="relative">
          <UnlockCard dict={dict} title="prep.council.title" body="prep.council.locked" />
          <button type="button" className="btn-ghost btn-sm absolute inset-e-3 top-3 px-2" onClick={close} aria-label={dict["common.close"]}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </dialog>
    </section>
  );
}
