// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { UiKey } from "@/content/seed/ui-strings";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Guided tours (pure parts, unit-tested). A tour is a short list of steps,
 * each pointing at an element marked `data-tour="<target>"`; when the tour
 * starts, steps whose element isn't on the page (another role, another state
 * of the page) are left out, so one tour fits every visitor. Nothing starts
 * by itself: a "?" button opens the tour, and a quiet "New here?" line shows
 * next to it until this device has opened or hidden that tour's version.
 */

export interface TourStep<T extends string = string> {
  /** The `data-tour` marker of the element to highlight; null for a step without one. */
  target: string | null;
  title: T;
  body: T;
}

export interface Tour<T extends string = string> {
  id: string;
  /** Raise it when the tour gains steps worth seeing: the "New here?" line then shows once more. */
  version: number;
  steps: readonly TourStep<T>[];
}

/** localStorage: the newest version of each tour this device has opened or hidden, `{ [id]: version }`. */
export const TOUR_STORAGE_KEY = "kd1241_tours";

export type SeenTours = Record<string, number>;

/** Tolerant: anything unreadable counts as nothing seen. */
export function parseSeen(raw: string | null): SeenTours {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => Number.isInteger(entry[1]) && entry[1] > 0));
  } catch {
    return {};
  }
}

export const hasSeen = (seen: SeenTours, tour: Pick<Tour, "id" | "version">): boolean => (seen[tour.id] ?? 0) >= tour.version;

export const markSeen = (seen: SeenTours, tour: Pick<Tour, "id" | "version">): SeenTours => ({ ...seen, [tour.id]: Math.max(seen[tour.id] ?? 0, tour.version) });

/** Space in px between the highlight and the card, the header or the screen's edge. */
export const TOUR_GAP = 16;

/** A vertical stretch of the viewport, in px from its top. */
export interface Band {
  top: number;
  bottom: number;
}

/**
 * How far to scroll so the highlighted element sits in the free band (under
 * the site header, above the card): centred when it fits, else its top at the
 * band's top. 0 when it is inside already.
 */
export function scrollDelta(target: Band, band: Band): number {
  if (target.top >= band.top && target.bottom <= band.bottom) return 0;
  const height = target.bottom - target.top;
  const room = band.bottom - band.top;
  return target.top - (height <= room ? band.top + (room - height) / 2 : band.top);
}

/**
 * The card waits at the bottom of the screen, unless the element still runs
 * under it (scrolling stops at the end of the page) while the top is free.
 */
export function cardSide(target: Band, viewportHeight: number, cardHeight: number): "top" | "bottom" {
  if (target.bottom <= viewportHeight - cardHeight - TOUR_GAP) return "bottom";
  return target.top >= cardHeight + 2 * TOUR_GAP ? "top" : "bottom";
}

/** A UI-string pair `tour.<key>.title` + `tour.<key>.body`: the steps players see are translated like every other string. */
export type TourKey<K = UiKey> = K extends `tour.${infer P}.title` ? (`tour.${P}.body` extends UiKey ? P : never) : never;
/** A `tour.<key>.body` whose title is the label of the element itself (no `tour.<key>.title`). */
export type LabelledTourKey<K = UiKey> = K extends `tour.${infer P}.body` ? P : never;

/**
 * One step from UI strings. A step about a labelled element (a button, a
 * heading) passes that label's key as its title, so the title always reads
 * like the element in every language instead of a separate translation.
 */
export function uiStep(target: string | null, key: TourKey): TourStep<UiKey>;
export function uiStep(target: string | null, key: LabelledTourKey, title: UiKey): TourStep<UiKey>;
export function uiStep(target: string | null, key: string, title?: UiKey): TourStep<UiKey> {
  return { target, title: title ?? (`tour.${key}.title` as UiKey), body: `tour.${key}.body` as UiKey };
}

/** `{{ui:<key>}}` in a step's text: the label of that element in the same language (a body that names a button). */
const UI_LABEL = /\{\{ui:([\w.-]+)\}\}/g;

export const uiLabelKeys = (text: string): string[] => [...text.matchAll(UI_LABEL)].map((m) => m[1]);

export const fillUiLabels = (text: string, dict: Dictionary): string =>
  text.replace(UI_LABEL, (whole, key: string) => (dict as Record<string, string>)[key] ?? whole);

/** The steps in the visitor's language. */
export const resolveSteps = (tour: Tour<UiKey>, dict: Dictionary): TourStep[] =>
  tour.steps.map((s) => ({ target: s.target, title: fillUiLabels(dict[s.title], dict), body: fillUiLabels(dict[s.body], dict) }));
