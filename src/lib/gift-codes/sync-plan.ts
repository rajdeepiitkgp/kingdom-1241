// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { DAY, HOUR } from "@/lib/time";
import type { FeedCode } from "./kingshot";

/**
 * What one gift-code check changes (pure, unit-tested; sync.ts makes the call
 * and the writes). kingshot.net lists the codes that work: a new one is
 * added, one we have by hand is taken over (so it ends with the list), and one
 * that left the list ends. Moderators' codes that kingshot.net doesn't list
 * are theirs to end. Codes are matched exactly: they are case-sensitive.
 */

/** The hourly check: the Gift codes workflow's schedule ("23 * * * *"). */
export const HOURLY_CHECK_MINUTE = 23;
/** Check now waits this long after the last check. */
export const CHECK_COOLDOWN_MS = 60 * 1000;
/** A failed check is retried quietly the next hour; once kingshot.net has failed this long, the run fails (GitHub e-mails the owner). */
export const FEED_STALE_AFTER = 6 * HOUR;
/** Ended and expired codes are deleted this long afterwards. */
export const KEEP_ENDED = 30 * DAY;

export type GiftCodeSource = "kingshot" | "manual";

export interface StoredGiftCode {
  id: string;
  code: string;
  source: GiftCodeSource;
  expiresAt: string | null;
  endedAt: string | null;
}

export interface GiftCodeUpdate {
  id: string;
  code: string;
  changes: { source?: "kingshot"; expiresAt?: string; endedAt?: null };
}

export interface GiftCodePlan {
  inserts: Array<{ code: string; expiresAt: string | null; addedAt: string }>;
  updates: GiftCodeUpdate[];
  /** In our list from kingshot.net, gone from theirs: no longer works. */
  ends: StoredGiftCode[];
  /** Ended or expired more than KEEP_ENDED ago. */
  deletes: StoredGiftCode[];
}

export function planGiftCodeSync(stored: readonly StoredGiftCode[], feed: readonly FeedCode[], now: number): GiftCodePlan {
  const byCode = new Map(stored.map((row) => [row.code, row]));
  const listed = new Set(feed.map((entry) => entry.code));
  const plan: GiftCodePlan = { inserts: [], updates: [], ends: [], deletes: [] };
  for (const entry of feed) {
    const row = byCode.get(entry.code);
    if (!row) {
      const created = entry.createdAt && Date.parse(entry.createdAt) <= now ? entry.createdAt : new Date(now).toISOString();
      plan.inserts.push({ code: entry.code, expiresAt: entry.expiresAt, addedAt: created });
      continue;
    }
    const changes: GiftCodeUpdate["changes"] = {};
    if (row.source !== "kingshot") changes.source = "kingshot";
    // Back in the list (a glitch on their side ended it): it works again.
    if (row.endedAt !== null) changes.endedAt = null;
    // kingshot.net's expiry wins when it has one; a typed one stays while it has none.
    if (entry.expiresAt !== null && entry.expiresAt !== row.expiresAt) changes.expiresAt = entry.expiresAt;
    if (Object.keys(changes).length > 0) plan.updates.push({ id: row.id, code: row.code, changes });
  }
  for (const row of stored) {
    if (listed.has(row.code)) continue;
    if (row.source === "kingshot" && row.endedAt === null) plan.ends.push(row);
    const over = [row.endedAt, row.expiresAt].map((time) => (time ? Date.parse(time) : Number.NaN)).filter((time) => time <= now);
    if (over.length > 0 && now - Math.min(...over) >= KEEP_ENDED) plan.deletes.push(row);
  }
  return plan;
}

/** Home's list changes (inserts, updates or ends): the only time Home needs rebuilding. */
export function planChangesHome(plan: GiftCodePlan): boolean {
  return plan.inserts.length + plan.updates.length + plan.ends.length > 0;
}

/** Where a code stands: Home shows it only while "home". */
export type GiftCodeState = "home" | "hidden" | "ended" | "expired";

export function giftCodeState(code: { active: boolean; endedAt: string | null; expiresAt: string | null }, now: number): GiftCodeState {
  if (code.endedAt) return "ended";
  if (code.expiresAt && Date.parse(code.expiresAt) <= now) return "expired";
  return code.active ? "home" : "hidden";
}

/** The last check, kept in app_config "gift_code_sync" for the admin page. */
export interface GiftCodeSyncState {
  /** When it ran (ISO), null before the first. */
  at: string | null;
  ok: boolean;
  by: "hourly" | "now" | null;
  /** The last check that got kingshot.net's list. */
  okAt: string | null;
  /** How many codes kingshot.net listed then. */
  listed: number;
}

export const NO_CHECK_YET: GiftCodeSyncState = { at: null, ok: false, by: null, okAt: null, listed: 0 };

export function parseGiftCodeSyncState(value: unknown): GiftCodeSyncState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return NO_CHECK_YET;
  const stored = value as Record<string, unknown>;
  const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  return {
    at: iso(stored.at),
    ok: stored.ok === true,
    by: stored.by === "hourly" || stored.by === "now" ? stored.by : null,
    okAt: iso(stored.okAt),
    listed: typeof stored.listed === "number" && Number.isInteger(stored.listed) && stored.listed >= 0 ? stored.listed : 0,
  };
}

export function nextSyncState(previous: GiftCodeSyncState, listed: number | null, at: string, by: "hourly" | "now"): GiftCodeSyncState {
  return listed === null ? { ...previous, at, ok: false, by } : { at, ok: true, by, okAt: at, listed };
}

/** kingshot.net has failed for FEED_STALE_AFTER (or never answered): time for someone to look. */
export function feedStale(state: GiftCodeSyncState, now: number): boolean {
  return !state.okAt || now - Date.parse(state.okAt) >= FEED_STALE_AFTER;
}
