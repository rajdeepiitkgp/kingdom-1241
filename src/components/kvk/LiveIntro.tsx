// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import clsx from "clsx";
import { renderBattleTokens } from "@/lib/kvk/battle-tokens";
import { MINUTE } from "@/lib/time";
import { useNow } from "../time/useNow";

/**
 * The plan intro when it contains {{when}} / {{date}} / {{time}} / {{utc}}
 * tokens: filled in for the visitor (UTC until hydrated, then their zone and
 * language, refreshed every minute so "tomorrow" becomes "today" at midnight).
 * `html` is already sanitised by the server (`prepareRichText`).
 */
export function LiveIntro({ html, battleAt, locale, className }: { html: string; battleAt: string | null; locale: string; className?: string }) {
  const now = useNow(MINUTE);
  return (
    <div
      className={clsx("prose-game", className)}
      dir="auto"
      // Sanitised on the server; the token values are escaped text.
      dangerouslySetInnerHTML={{ __html: renderBattleTokens(html, battleAt, { locale, now }) }}
    />
  );
}
