"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFormStatus } from "react-dom";
import { moveRow } from "@/lib/admin/kvk-actions";

/**
 * ▲ position ▼ next to an instruction, coordinator or formation. Each arrow
 * submits the row one step in that direction; the editor re-renders in place.
 */
export function MoveButtons({
  locale,
  planId,
  table,
  id,
  position,
  count,
  label,
  className,
}: {
  locale: string;
  planId: string;
  table: "kvk_rules" | "kvk_coordinators" | "kvk_formations";
  id: string;
  /** 0-based position in the list. */
  position: number;
  count: number;
  /** What the row is, for the button names ("instruction", "coordinator", "formation"). */
  label: string;
  className?: string;
}) {
  return (
    <form action={moveRow} className={clsx("flex shrink-0 flex-col items-center gap-0.5", className)}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <Arrow direction="up" disabled={position === 0} title={`Move ${label} up`} />
      <span className="text-[0.6875rem] font-black text-ink-faint tabular" aria-hidden>
        {position + 1}
      </span>
      <Arrow direction="down" disabled={position >= count - 1} title={`Move ${label} down`} />
    </form>
  );
}

function Arrow({ direction, disabled, title }: { direction: "up" | "down"; disabled: boolean; title: string }) {
  const { pending } = useFormStatus();
  const Icon = direction === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="submit"
      name="direction"
      value={direction}
      disabled={disabled || pending}
      aria-label={title}
      title={title}
      className="grid size-7 place-items-center rounded-lg border border-line bg-card text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
