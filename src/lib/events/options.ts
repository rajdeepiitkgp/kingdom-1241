import type { EventCategory, EventTiming } from "@/lib/data/types";

/** The choices an event's editor offers (pure; the mapper and the form parser share them). */

export const EVENT_CATEGORIES: readonly EventCategory[] = ["alliance", "kingdom", "cross-kingdom", "solo"];

export const EVENT_TIMINGS: readonly EventTiming[] = ["fixed", "alliance"];

/** Accent colours of the event cards (`EVENT_COLORS` in the UI has one entry per key). */
export const EVENT_COLOR_KEYS = ["amber", "red", "violet", "sky", "gold", "emerald", "pink"] as const;
export type EventColorKey = (typeof EVENT_COLOR_KEYS)[number];
