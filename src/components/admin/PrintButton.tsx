"use client";

import { Printer } from "lucide-react";
import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** Opens the browser's print dialog (where "Save as PDF" is one of the printers). Not drawn where the browser can't print. */
export function PrintButton() {
  const canPrint = useSyncExternalStore(noSubscribe, () => typeof window.print === "function", () => false);
  if (!canPrint) return null;
  return (
    <button
      type="button"
      className="btn-primary btn-sm"
      data-tour="print-button"
      onClick={() => {
        try {
          window.print();
        } catch {
          // Some in-app browsers refuse; the page stays as it is.
        }
      }}
    >
      <Printer className="size-4" aria-hidden />
      Print or save as PDF
    </button>
  );
}
