"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The current time, ticking every `intervalMs`. Returns `null` on the server
 * and during hydration so that time-dependent UI never causes a hydration
 * mismatch (server and visitor are in different time zones anyway).
 */
export function useNow(intervalMs = 1000): Date | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = window.setInterval(onChange, intervalMs);
      return () => window.clearInterval(id);
    },
    [intervalMs],
  );
  const getSnapshot = useCallback(() => Math.floor(Date.now() / intervalMs) * intervalMs, [intervalMs]);
  const getServerSnapshot = () => null;

  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === null ? null : new Date(ms);
}
