"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";
import { TEXT_SCALE_INIT_SCRIPT } from "@/lib/text-scale";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/**
 * Applies the saved theme and text size before the first paint. The script is
 * written into the server-rendered HTML only and never rendered by React on
 * the client, so a client-side re-render of the root layout (a language
 * switch) doesn't recreate a <script> that could not run anyway;
 * PersistentUiState re-applies both preferences in that case.
 */
export function UiInit() {
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + TEXT_SCALE_INIT_SCRIPT }} />;
  });
  return null;
}
