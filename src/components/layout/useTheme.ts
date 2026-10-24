"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readStoredTheme, THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverSnapshot = () => null;

/** The saved theme (`null` while hydrating, since only the browser knows it) and a setter. */
export function useTheme(): { theme: Theme | null; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, serverSnapshot);
  return { theme, setTheme: applyTheme };
}
