"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { withViewTransition } from "@/lib/view-transition";

const subscribeNoop = () => () => {};
const isClient = () => true;
const isServer = () => false;

export function ThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known on the client; render a neutral icon while hydrating.
  const mounted = useSyncExternalStore(subscribeNoop, isClient, isServer);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = isDark ? "light" : "dark";
        // flushSync commits the new theme (state + <html> class) inside the transition
        // callback, so the crossfade's new frame already shows it.
        withViewTransition(() => flushSync(() => setTheme(next)));
      }}
      className="btn-ghost btn-sm size-10 shrink-0 rounded-full p-0!"
    >
      {isDark ? <Sun className="size-5 text-gold" aria-hidden /> : <Moon className="size-5 text-primary" aria-hidden />}
    </button>
  );
}
