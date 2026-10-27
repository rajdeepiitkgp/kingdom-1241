// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { KeyboardEvent } from "react";
import { type StepKind, stepTime } from "@/lib/rally-sync/timing";

/**
 * Arrow keys for a time field: ↑ / ↓ one step up or down, with Shift ten,
 * written back the way it was typed (stepTime). The fields stay plain text
 * inputs read through FormData, so this only changes the input's value; the
 * coordinator still presses Set or Save. Touch keyboards have no arrows, so
 * phones see no difference. `seed` fills an empty field first (the current hit
 * time, so ↑ nudges it a second later).
 */
export function stepKeys(kind: StepKind, hint: string, { min, max, seed }: { min?: number; max?: number; seed?: () => string | null } = {}) {
  return {
    title: hint,
    "aria-keyshortcuts": "ArrowUp ArrowDown Shift+ArrowUp Shift+ArrowDown",
    onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if ((event.key !== "ArrowUp" && event.key !== "ArrowDown") || event.altKey || event.ctrlKey || event.metaKey) return;
      const input = event.currentTarget;
      const delta = (event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 10 : 1);
      const next = stepTime(input.value.trim() || (seed?.() ?? ""), delta, kind, min, max);
      if (next === null) return;
      event.preventDefault();
      input.value = next;
    },
  };
}
