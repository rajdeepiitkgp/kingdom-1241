// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { MINUTE } from "@/lib/time";
import type { RoomMode } from "./room";

/**
 * How many Rally Sync rooms, leaders and browsers there may be (pure,
 * unit-tested). The owner sets the limits per room type on the settings page;
 * they are stored in `app_config` ("rally_sync_capacity") and enforced by the
 * database, which repeats DEFAULT_CAPACITY and CAPACITY_BOUNDS (migration
 * 0016; a test compares them).
 *
 * The three room types share one budget: every browser with a room open holds
 * one live connection to Supabase Realtime, and the free plan allows 200. So
 * the most browsers all open rooms could hold together (rooms × browsers per
 * room, added up over the types) must stay within BROWSER_BUDGET, which keeps
 * 20 spare (a room open in two tabs of one browser counts once but connects
 * twice). Leaders don't add to it: a leader is a browser already, or one the
 * coordinator added for a player who isn't on the site.
 */

export type CapacityField = "rooms" | "leaders" | "browsers";

export interface ModeCapacity {
  /** Rooms of this type open at once. */
  rooms: number;
  /** Leaders per room (garrison rooms have none: defenders plan on their own device). */
  leaders: number;
  /** Browsers per room that had it on screen in the last ACTIVE_BROWSER_MINUTES. */
  browsers: number;
}

export type Capacity = Record<RoomMode, ModeCapacity>;

/** What is in use right now for one type (the settings page's "open now"). */
export interface CapacityUsage {
  rooms: number;
  /** Browsers that had one of these rooms on screen in the last ACTIVE_BROWSER_MINUTES. */
  browsers: number;
  leaders: number;
}

/** The order the settings page shows the types in. */
export const CAPACITY_MODES: readonly RoomMode[] = ["rally", "garrison", "counter"];

/** Supabase free plan: live Realtime connections at once. */
export const REALTIME_CONNECTIONS = 200;
/** The most browsers all open rooms may hold together. */
export const BROWSER_BUDGET = 180;
/** A browser counts while it had the room on screen this recently (open pages check in every three minutes), so one that left frees its place. */
export const ACTIVE_BROWSER_MINUTES = 10;
export const ACTIVE_BROWSER_MS = ACTIVE_BROWSER_MINUTES * MINUTE;

/** A battle day on castle and turrets: five rally rooms, five garrison rooms, one counter-rally room (180 browsers in all). */
export const DEFAULT_CAPACITY: Capacity = {
  rally: { rooms: 5, leaders: 10, browsers: 12 },
  garrison: { rooms: 5, leaders: 0, browsers: 22 },
  counter: { rooms: 1, leaders: 10, browsers: 10 },
};

/** The smallest and largest value of every number. */
export const CAPACITY_BOUNDS: Record<RoomMode, Record<CapacityField, readonly [number, number]>> = {
  rally: { rooms: [1, 8], leaders: [2, 15], browsers: [5, 30] },
  garrison: { rooms: [1, 8], leaders: [0, 0], browsers: [5, 60] },
  counter: { rooms: [1, 2], leaders: [2, 15], browsers: [2, 20] },
};

const FIELDS: readonly CapacityField[] = ["rooms", "leaders", "browsers"];

function clamp(mode: RoomMode, field: CapacityField, value: number): number {
  const [min, max] = CAPACITY_BOUNDS[mode][field];
  return Math.min(max, Math.max(min, value));
}

/** The stored value as limits (tolerant: a missing or malformed number takes its default, every number stays within its bounds). */
export function parseCapacity(value: unknown): Capacity {
  const stored = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const out = {} as Capacity;
  for (const mode of CAPACITY_MODES) {
    const raw = typeof stored[mode] === "object" && stored[mode] !== null ? (stored[mode] as Record<string, unknown>) : {};
    const limits = {} as ModeCapacity;
    for (const field of FIELDS) {
      const n = raw[field];
      limits[field] = clamp(mode, field, typeof n === "number" && Number.isInteger(n) ? n : DEFAULT_CAPACITY[mode][field]);
    }
    out[mode] = limits;
  }
  return out;
}

export interface CapacityTotals {
  /** Browsers each type's rooms could hold together. */
  perMode: Record<RoomMode, number>;
  total: number;
  /** How far the total is above BROWSER_BUDGET (0 when within). */
  over: number;
}

export function capacityTotals(capacity: Capacity): CapacityTotals {
  const perMode = {} as Record<RoomMode, number>;
  for (const mode of CAPACITY_MODES) perMode[mode] = capacity[mode].rooms * capacity[mode].browsers;
  const total = CAPACITY_MODES.reduce((sum, mode) => sum + perMode[mode], 0);
  return { perMode, total, over: Math.max(0, total - BROWSER_BUDGET) };
}

/** Lowering one number to `to` brings the total back within the budget. */
export interface CapacityFix {
  mode: RoomMode;
  field: "rooms" | "browsers";
  from: number;
  to: number;
}

/**
 * Every way back within the budget by lowering a single number (as little as
 * needed, never below its minimum), the smallest cut first; none while within.
 */
export function capacityFixes(capacity: Capacity): CapacityFix[] {
  const { perMode, total } = capacityTotals(capacity);
  if (total <= BROWSER_BUDGET) return [];
  const fixes: CapacityFix[] = [];
  for (const mode of CAPACITY_MODES) {
    // What this type may use once the other two keep theirs.
    const room = BROWSER_BUDGET - (total - perMode[mode]);
    for (const field of ["browsers", "rooms"] as const) {
      const other = field === "rooms" ? capacity[mode].browsers : capacity[mode].rooms;
      const to = Math.floor(room / other);
      const from = capacity[mode][field];
      if (to >= CAPACITY_BOUNDS[mode][field][0] && to < from) fixes.push({ mode, field, from, to });
    }
  }
  const cut = (fix: CapacityFix) => (fix.from - fix.to) / fix.from;
  return fixes.sort((a, b) => cut(a) - cut(b));
}

/** The form field of a number ("garrison-browsers"). */
export function capacityFieldName(mode: RoomMode, field: CapacityField): string {
  return `${mode}-${field}`;
}

/** Which numbers can be changed: garrison rooms have no leaders. */
export function isEditable(mode: RoomMode, field: CapacityField): boolean {
  const [min, max] = CAPACITY_BOUNDS[mode][field];
  return min !== max;
}

export type CapacityFormResult = { ok: true; value: Capacity } | { ok: false; errors: Record<string, string>; message?: string };

/** The settings form (strict: every number whole and within its bounds, and all rooms together within the budget). */
export function parseCapacityForm(form: { get(name: string): unknown }): CapacityFormResult {
  const errors: Record<string, string> = {};
  const value = {} as Capacity;
  for (const mode of CAPACITY_MODES) {
    const limits = {} as ModeCapacity;
    for (const field of FIELDS) {
      const [min, max] = CAPACITY_BOUNDS[mode][field];
      if (!isEditable(mode, field)) {
        limits[field] = min;
        continue;
      }
      const raw = form.get(capacityFieldName(mode, field));
      const n = typeof raw === "string" && /^\d{1,4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
      if (Number.isInteger(n) && n >= min && n <= max) limits[field] = n;
      else errors[capacityFieldName(mode, field)] = `${min} to ${max}.`;
    }
    value[mode] = limits;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const { total, over } = capacityTotals(value);
  if (over > 0) {
    return { ok: false, errors: {}, message: `Together the rooms could hold ${total} browsers, ${over} more than the ${BROWSER_BUDGET} allowed. Lower one of the highlighted numbers.` };
  }
  return { ok: true, value };
}

export function sameCapacity(a: Capacity, b: Capacity): boolean {
  return CAPACITY_MODES.every((mode) => FIELDS.every((field) => a[mode][field] === b[mode][field]));
}
