// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SyncError, SyncResult } from "@/lib/rally-sync/actions";
import { bestOffset, CLOCK_SAMPLES, type ClockSample, clockSample } from "@/lib/rally-sync/clock";
import { type DeviceData, parseDevice, readDeviceRaw, subscribeDevice } from "@/lib/rally-sync/device";
import { connectRoomChannel, type LinkStatus } from "@/lib/rally-sync/realtime";
import { HEARTBEAT_MS, type RoomState } from "@/lib/rally-sync/room";

/** This browser's Rally Sync memory (see device.ts); empty on the server and during hydration. */
export function useDevice(): DeviceData {
  const raw = useSyncExternalStore(subscribeDevice, readDeviceRaw, () => "");
  return useMemo(() => parseDevice(raw), [raw]);
}

/**
 * The corrected clock (device + offset) on whole seconds, ticking exactly when
 * the second changes, like the in-game clock; null until hydrated. Every tick
 * is computed from Date.now(), so nothing drifts, and coming back to the tab
 * re-reads the time at once.
 */
export function useCorrectedSecond(offsetMs: number): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      let timer = 0;
      const schedule = () => {
        const now = Date.now() + offsetMs;
        timer = window.setTimeout(() => {
          onChange();
          schedule();
        }, 1000 - (((now % 1000) + 1000) % 1000) + 5);
      };
      schedule();
      const onVisible = () => onChange();
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },
    [offsetMs],
  );
  const getSnapshot = useCallback(() => Math.floor((Date.now() + offsetMs) / 1000) * 1000, [offsetMs]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export type RoomEnding = "closed" | "locked" | null;

export interface RoomSync {
  state: RoomState;
  link: LinkStatus;
  offsetMs: number;
  ending: RoomEnding;
  /** Device time of the last successful update (ms), null before the first. */
  updatedAt: number | null;
  refresh: () => void;
}

/** Without Realtime (local review) pages poll often; with it, only as a fallback while the link is down. */
const POLL_LIVE_FALLBACK_MS = 30_000;
const POLL_NO_REALTIME_MS = 5_000;
const PING_GAP_MS = 1_500;

/**
 * The room's state on this page: refetched after every Realtime ping (spread
 * over a moment so phones don't all ask at once), when the tab comes back, on
 * a heartbeat while on screen (that keeps the room open) and by polling when
 * the link is down. Pages that aren't visible don't fetch.
 */
export function useRoomSync(code: string, initial: RoomState, realtime: { url: string; key: string } | null): RoomSync {
  const [state, setState] = useState(initial);
  const [link, setLink] = useState<LinkStatus>(realtime ? "connecting" : "offline");
  const [offsetMs, setOffsetMs] = useState(0);
  const [ending, setEnding] = useState<RoomEnding>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const samples = useRef<ClockSample[]>([]);
  const busy = useRef(false);
  const again = useRef(false);
  const stale = useRef(false);
  const pingTimer = useRef(0);
  const lastPingFetch = useRef(0);

  const refresh = useCallback(() => {
    if (document.visibilityState === "hidden") {
      stale.current = true;
      return;
    }
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    stale.current = false;
    void (async () => {
      do {
        again.current = false;
        try {
          const sentAt = Date.now();
          const response = await fetch(`/api/rally-sync/${code}`, { cache: "no-store" });
          const receivedAt = Date.now();
          if (response.status === 404 || response.status === 410) setEnding("closed");
          else if (response.status === 403) setEnding("locked");
          else if (response.ok) {
            const next = (await response.json()) as RoomState;
            samples.current = [...samples.current.slice(1 - CLOCK_SAMPLES), clockSample(sentAt, receivedAt, next.serverNow)];
            setOffsetMs(bestOffset(samples.current));
            setState(next);
            setUpdatedAt(receivedAt);
          }
        } catch {
          // Offline for a moment: keep showing what we have; the countdown runs on.
        }
      } while (again.current);
      busy.current = false;
    })();
  }, [code]);

  // First sample of the clock offset right away; then on resume, heartbeat and network return.
  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    const heartbeat = window.setInterval(refresh, HEARTBEAT_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      window.clearInterval(heartbeat);
      window.clearTimeout(pingTimer.current);
    };
  }, [refresh]);

  const channel = initial.room.channel;
  useEffect(() => {
    if (!realtime) return;
    return connectRoomChannel({
      url: realtime.url,
      apiKey: realtime.key,
      topic: channel,
      onStatus: setLink,
      // A ping is only a hint (anyone who knows a public topic could send one): "closed" refetches at once, "changed" after a
      // moment, and only the server's answer can close the room on this page.
      // At most one ping-driven fetch per PING_GAP_MS, so a flood of fake pings can't turn into a flood of requests.
      onPing: (event) => {
        if (pingTimer.current) return;
        const wait = Math.max(event === "closed" ? 0 : 150 + Math.random() * 750, lastPingFetch.current + PING_GAP_MS - Date.now());
        pingTimer.current = window.setTimeout(() => {
          pingTimer.current = 0;
          lastPingFetch.current = Date.now();
          refresh();
        }, wait);
      },
    });
  }, [realtime, channel, refresh]);

  // Polling only while there is no live link.
  useEffect(() => {
    if (link === "live" || ending) return;
    const id = window.setInterval(refresh, realtime ? POLL_LIVE_FALLBACK_MS : POLL_NO_REALTIME_MS);
    return () => window.clearInterval(id);
  }, [link, ending, realtime, refresh]);

  return { state, link, offsetMs, ending, updatedAt, refresh };
}

/**
 * Runs one Server Action of the room at a time and remembers which control's
 * action failed (`where`), so the error shows next to it. On success the room
 * is refetched at once instead of waiting for the Realtime ping.
 */
export function useRunner(onDone: () => void) {
  const [pending, setPending] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ where: string; error: SyncError } | null>(null);
  const run = useCallback(
    async <T extends object>(where: string, action: () => Promise<SyncResult<T>>): Promise<({ ok: true } & T) | null> => {
      setPending(where);
      setFailure(null);
      try {
        const result = await action();
        if (!result.ok) {
          setFailure({ where, error: result.error });
          return null;
        }
        onDone();
        return result;
      } catch {
        setFailure({ where, error: "failed" });
        return null;
      } finally {
        setPending(null);
      }
    },
    [onDone],
  );
  const errorFor = (where: string) => (failure?.where === where ? failure.error : null);
  return { pending, run, errorFor, fail: (where: string, error: SyncError) => setFailure({ where, error }) };
}

/** Keeps the screen on while `enabled` and the page is visible (re-acquired when the tab comes back). */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== "visible" || sentinel) return;
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (cancelled) void lock.release();
          else {
            sentinel = lock;
            lock.addEventListener("release", () => {
              sentinel = null;
            });
          }
        })
        .catch(() => undefined);
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release();
    };
  }, [enabled]);
}
