"use client";

import { useEffect } from "react";
import { applyTextScale, DEFAULT_TEXT_SCALE, readStoredTextScale, TEXT_SCALE_ATTRIBUTE } from "@/lib/text-scale";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import { markNavigationSettled } from "@/lib/view-transition";

/**
 * Keeps the viewer's preferences on <html> across language switches.
 *
 * `[locale]` is a root param, so changing language mounts a new root layout
 * and React re-acquires the <html> element, resetting its attributes to the
 * layout's props. That drops the `dark` class and the `data-text-scale`
 * attribute, although both are still saved. React does this after child
 * effects have run, so an effect alone is overwritten; instead a
 * MutationObserver re-asserts the saved values whenever <html> loses them.
 * It only writes when the DOM differs from the saved state, so it can't loop.
 */
export function PersistentUiState({ locale }: { locale: string }) {
  // Lets a language-switch crossfade finish once this locale is on screen.
  useEffect(() => {
    markNavigationSettled();
  }, [locale]);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const scale = readStoredTextScale();
      const wanted = scale === DEFAULT_TEXT_SCALE ? null : scale;
      if (root.getAttribute(TEXT_SCALE_ATTRIBUTE) !== wanted) applyTextScale(scale, false);

      const theme = readStoredTheme();
      if (root.classList.contains("dark") !== (theme === "dark")) applyTheme(theme, false);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class", TEXT_SCALE_ATTRIBUTE] });
    return () => observer.disconnect();
  }, []);

  return null;
}
