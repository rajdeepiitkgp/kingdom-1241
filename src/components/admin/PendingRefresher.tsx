"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While a machine translation is running, re-fetches the page every few seconds (for up to three minutes). */
export function PendingRefresher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - started > 3 * 60_000) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [active, router]);
  return null;
}
