"use client";

import { LockKeyhole } from "lucide-react";
import { lockKvk } from "@/lib/kvk/actions";

/** Clears the access cookie (for shared devices). The page re-renders locked. */
export function LockButton({ label }: { label: string }) {
  return (
    <form action={lockKvk}>
      <button type="submit" className="btn-ghost btn-sm">
        <LockKeyhole className="size-4" aria-hidden />
        {label}
      </button>
    </form>
  );
}
