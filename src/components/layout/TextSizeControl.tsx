"use client";

import { AArrowDown, AArrowUp, ALargeSmall } from "lucide-react";
import { useSyncExternalStore } from "react";
import { format } from "@/lib/i18n/dictionary";
import { withViewTransition } from "@/lib/view-transition";
import {
  applyTextScale,
  canChangeTextScale,
  DEFAULT_TEXT_SCALE,
  nextTextScale,
  parseTextScale,
  TEXT_SCALE_ATTRIBUTE,
  TEXT_SCALE_CHANGE_EVENT,
  TEXT_SCALE_PERCENT,
  type TextScale,
} from "@/lib/text-scale";

/**
 * A− / A / A+ buttons that step the root font size (see src/lib/text-scale.ts);
 * the middle one returns to the default. The current value lives on
 * <html data-text-scale> (set before paint by the inline script in the
 * layout) and in localStorage; this component only mirrors it.
 */

function subscribe(onChange: () => void) {
  window.addEventListener(TEXT_SCALE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(TEXT_SCALE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readScale(): TextScale {
  return parseTextScale(document.documentElement.getAttribute(TEXT_SCALE_ATTRIBUTE) ?? DEFAULT_TEXT_SCALE);
}

const BUTTON =
  "grid h-full w-8 place-items-center text-ink transition-colors hover:bg-card-soft disabled:cursor-not-allowed disabled:opacity-40 sm:w-9";

export function TextSizeControl({
  labels,
}: {
  labels: { group: string; smaller: string; reset: string; larger: string; current: string };
}) {
  const scale = useSyncExternalStore(subscribe, readScale, () => DEFAULT_TEXT_SCALE);
  const percent = TEXT_SCALE_PERCENT[scale];

  return (
    <div
      role="group"
      aria-label={labels.group}
      className="flex h-10 shrink-0 items-center overflow-hidden rounded-full border border-line bg-card shadow-[0_4px_0_0_var(--line)]"
    >
      <button
        type="button"
        onClick={() => withViewTransition(() => applyTextScale(nextTextScale(scale, -1)))}
        disabled={!canChangeTextScale(scale, -1)}
        aria-label={labels.smaller}
        title={labels.smaller}
        className={BUTTON}
      >
        <AArrowDown className="size-5" aria-hidden />
      </button>
      <span className="h-5 w-px bg-line" aria-hidden />
      <button
        type="button"
        onClick={() => withViewTransition(() => applyTextScale(DEFAULT_TEXT_SCALE))}
        disabled={scale === DEFAULT_TEXT_SCALE}
        aria-label={labels.reset}
        title={labels.reset}
        className={BUTTON}
      >
        <ALargeSmall className="size-5" aria-hidden />
      </button>
      <span className="h-5 w-px bg-line" aria-hidden />
      <button
        type="button"
        onClick={() => withViewTransition(() => applyTextScale(nextTextScale(scale, 1)))}
        disabled={!canChangeTextScale(scale, 1)}
        aria-label={labels.larger}
        title={labels.larger}
        className={BUTTON}
      >
        <AArrowUp className="size-5" aria-hidden />
      </button>
      {/* Screen readers hear the new size; sighted users see the text grow. */}
      <span className="sr-only" aria-live="polite">
        {format(labels.current, { percent })}
      </span>
    </div>
  );
}
