"use client";

import clsx from "clsx";
import { Check, ListChecks } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type { ChecklistPhase } from "@/lib/data/types";
import { format, type Dictionary } from "@/lib/i18n/dictionary";
import { checklistProgress, parseTicked, toggleTicked } from "@/lib/kvk/checklist";

/** One phase of the checklist with its items, already in the visitor's language. */
export interface ChecklistGroup {
  phase: ChecklistPhase;
  items: Array<{ id: string; text: string; note: string }>;
}

/**
 * The commander's checklist by phase, with a progress bar. Ticks are kept in
 * this browser only (per battle plan, so the next battle starts fresh) and read
 * through useSyncExternalStore, like the formations' "saved" checklist.
 */

const CHANGE_EVENT = "kd1241:checklist";
const storageKey = (planId: string) => `kd1241_checklist_${planId}`;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeTicked(key: string, ids: string[]) {
  try {
    if (ids.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode / storage blocked: the ticks just don't persist.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function ChecklistBoard({ planId, groups, dict }: { planId: string; groups: ChecklistGroup[]; dict: Dictionary }) {
  const key = storageKey(planId);
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => "");
  const ticked = useMemo(() => new Set(parseTicked(raw)), [raw]);
  const itemIds = useMemo(() => groups.flatMap((g) => g.items.map((i) => i.id)), [groups]);
  const { done, total } = checklistProgress(itemIds, ticked);
  const progress = format(dict["checklist.progress"], { done, total });

  return (
    <div className="space-y-6">
      <div className="card-soft flex flex-wrap items-center gap-3 px-4 py-3">
        <ListChecks className="size-5 shrink-0 text-primary" aria-hidden />
        {/* basis-48: with long words (German, largest text) the reset button wraps below instead of squeezing the count. */}
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-sm font-extrabold text-ink" aria-live="polite">
            {progress}
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={progress} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
            <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
        </div>
        {done > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => writeTicked(key, [])}>
            {dict["kvk.resetProgress"]}
          </button>
        )}
      </div>
      {total > 0 && done === total && (
        <p className="rounded-2xl bg-success-soft px-4 py-3 text-center text-sm font-extrabold text-success">🎉 {dict["checklist.progressDone"]}</p>
      )}

      {groups.map((group) => {
        const ids = group.items.map((i) => i.id);
        const phase = checklistProgress(ids, ticked);
        return (
          <div key={group.phase}>
            <h3 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-black tracking-wider text-ink-muted uppercase">
              {dict[`checklist.phase.${group.phase}`]}
              <span className={clsx("chip normal-case", phase.done === phase.total ? "bg-success-soft text-success" : "bg-card-soft text-ink-muted")} dir="ltr">
                {phase.done}/{phase.total}
              </span>
            </h3>
            <ul className="grid grid-cols-1 gap-2">
              {group.items.map((item) => {
                const isTicked = ticked.has(item.id);
                return (
                  <li key={item.id}>
                    <label className={clsx("card flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors", isTicked && "bg-success-soft")}>
                      {/* Toggled against the stored ticks, not this render's: two quick taps must both count. */}
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={isTicked}
                        onChange={() => writeTicked(key, toggleTicked(new Set(parseTicked(readRaw(key))), item.id, itemIds))}
                      />
                      <span
                        className={clsx(
                          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-primary/40",
                          isTicked ? "border-success bg-success text-card" : "border-line bg-card",
                        )}
                        aria-hidden
                      >
                        {isTicked && <Check className="size-4" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={clsx("block text-[0.98rem] font-semibold wrap-break-word", isTicked ? "text-ink-muted line-through" : "text-ink")} dir="auto">
                          {item.text}
                        </span>
                        {item.note && (
                          <span className="mt-0.5 block text-sm font-semibold wrap-break-word text-ink-muted" dir="auto">
                            {item.note}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
