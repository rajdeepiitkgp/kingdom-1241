"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

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
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="btn-ghost btn-sm size-10 rounded-full !px-0 !py-0"
    >
      {isDark ? <Sun className="size-5 text-gold" aria-hidden /> : <Moon className="size-5 text-primary" aria-hidden />}
    </button>
  );
}
