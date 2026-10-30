import type { GameEvent } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";

/** An event as the browser sees it: the texts in the visitor's language only, not every translation. */
export type EventView = Omit<GameEvent, "name" | "summary"> & { name: string; summary: string };

export function eventView(event: GameEvent, locale: string): EventView {
  return { ...event, name: pick(event.name, locale), summary: pick(event.summary, locale) };
}
