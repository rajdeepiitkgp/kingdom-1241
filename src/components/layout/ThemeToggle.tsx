"use client";

import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";
import { withViewTransition } from "@/lib/view-transition";
import { useTheme } from "./useTheme";

export function ThemeToggle({ label }: { label: string }) {
  // `theme` is null while hydrating (only the browser knows it): a neutral icon until then.
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        // flushSync commits the new theme (state + <html> class) inside the transition
        // callback, so the crossfade's new frame already shows it.
        withViewTransition(() => flushSync(() => setTheme(isDark ? "light" : "dark")));
      }}
      className="btn-ghost btn-sm size-10 shrink-0 rounded-full p-0!"
    >
      {isDark ? <Sun className="size-5 text-gold" aria-hidden /> : <Moon className="size-5 text-primary" aria-hidden />}
    </button>
  );
}
