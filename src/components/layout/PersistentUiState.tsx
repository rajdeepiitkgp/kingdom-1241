"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";
import { applyTextScale, DEFAULT_TEXT_SCALE, readStoredTextScale, TEXT_SCALE_ATTRIBUTE } from "@/lib/text-scale";
import { markNavigationSettled } from "@/lib/view-transition";

/**
 * Keeps the viewer's preferences on <html> across language switches.
 *
 * `[locale]` is a root param, so changing language mounts a new root layout
 * and React re-acquires the <html> element, resetting its attributes to the
 * layout's props. That drops the `dark` class next-themes added and the
 * `data-text-scale` attribute, although both are still saved. React does this
 * after child effects have run, so an effect alone is overwritten; instead a
 * MutationObserver re-asserts the saved values whenever <html> loses them.
 * It only writes when the DOM differs from the saved state, so it can't loop.
 */
export function PersistentUiState({ locale }: { locale: string }) {
  const { resolvedTheme } = useTheme();

  // Lets a language-switch crossfade finish once this locale is on screen.
  useEffect(() => {
    markNavigationSettled();
  }, [locale]);

  // Re-registered whenever the theme changes, so `sync` always knows the current one.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const scale = readStoredTextScale();
      const wanted = scale === DEFAULT_TEXT_SCALE ? null : scale;
      if (root.getAttribute(TEXT_SCALE_ATTRIBUTE) !== wanted) applyTextScale(scale, false);

      if (resolvedTheme === "dark" || resolvedTheme === "light") {
        if (root.classList.contains("dark") !== (resolvedTheme === "dark")) {
          root.classList.toggle("dark", resolvedTheme === "dark");
          root.classList.toggle("light", resolvedTheme === "light");
          root.style.colorScheme = resolvedTheme;
        }
      }
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class", TEXT_SCALE_ATTRIBUTE] });
    return () => observer.disconnect();
  }, [resolvedTheme]);

  return null;
}
