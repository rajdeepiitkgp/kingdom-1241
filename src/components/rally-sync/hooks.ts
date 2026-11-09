// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SyncError, SyncResult } from "@/lib/rally-sync/actions";
import { bestOffset, CLOCK_SAMPLES, type ClockSample, clockSample } from "@/lib/rally-sync/clock";
import { type DeviceData, parseDevice, readDeviceRaw, subscribeDevice } from "@/lib/rally-sync/device";
import { connectRoomChannel, type LinkStatus } from "@/lib/rally-sync/realtime";
import { HEARTBEAT_MS, type RoomState } from "@/lib/rally-sync/room";
import { applyChatFetch, type ChatState, lastMessageId, type MessageView } from "@/lib/rally-sync/room-chat";

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
  /** Counts the Realtime "chat" pings (the chat panel fetches new messages when it changes). */
  chatVersion: number;
}

/** Without Realtime (local review) pages poll often; with it, only as a fallback while the link is down. */
const POLL_LIVE_FALLBACK_MS = 30_000;
const POLL_NO_REALTIME_MS = 5_000;
const PING_GAP_MS = 1_500;
/** A burst of chat pings (several messages at once) becomes one fetch. */
const CHAT_PING_GAP_MS = 800;

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
  const [chatVersion, setChatVersion] = useState(0);
  const chatTimer = useRef(0);

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
      window.clearTimeout(chatTimer.current);
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
        // A chat ping concerns the messages alone (their own route); a burst of them is one fetch.
        if (event === "chat") {
          if (chatTimer.current) return;
          chatTimer.current = window.setTimeout(() => {
            chatTimer.current = 0;
            setChatVersion((v) => v + 1);
          }, CHAT_PING_GAP_MS);
          return;
        }
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

  return { state, link, offsetMs, ending, updatedAt, refresh, chatVersion };
}

export type ChatStatus = "loading" | "ready" | "unavailable";

export interface RoomChatSync {
  messages: MessageView[];
  /** The coordinator's pinned message, if any. */
  pinned: MessageView | null;
  /** "unavailable" when the room has no chat (a deploy ahead of its migration, or a database problem on the first load). */
  status: ChatStatus;
  /** The newest message id at the first load: what was there already doesn't count as new. */
  loadedAtId: number;
  refresh: () => void;
}

/**
 * The room chat on this page: fetched on load, after every Realtime "chat"
 * ping (`version`), when the tab comes back and by polling while the link is
 * down, each time only the messages after the last one it has. What the
 * room no longer holds (a cleared chat) is dropped (applyChatFetch).
 */
export function useRoomChat(code: string, version: number, link: LinkStatus, realtime: boolean): RoomChatSync {
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [pinned, setPinned] = useState<MessageView | null>(null);
  const [status, setStatus] = useState<ChatStatus>("loading");
  const [loadedAtId, setLoadedAtId] = useState(0);
  const latest = useRef<MessageView[]>([]);
  const loadedOnce = useRef(false);
  const busy = useRef(false);
  const again = useRef(false);

  const refresh = useCallback(() => {
    if (document.visibilityState === "hidden") return; // fetched again when the tab comes back
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    void (async () => {
      do {
        again.current = false;
        try {
          const response = await fetch(`/api/rally-sync/${code}/chat?after=${lastMessageId(latest.current)}`, { cache: "no-store" });
          if (response.ok) {
            const next = (await response.json()) as ChatState;
            latest.current = applyChatFetch(latest.current, next);
            setMessages(latest.current);
            setPinned((current) => (current?.id === next.pinned?.id && current?.body === next.pinned?.body ? current : next.pinned));
            setStatus("ready");
            if (!loadedOnce.current) {
              loadedOnce.current = true;
              setLoadedAtId(lastMessageId(latest.current));
            }
          } else if (response.status === 503) {
            // No chat on this room (yet): the panel stays away. Once it worked, a passing problem keeps what we have.
            setStatus((current) => (current === "ready" ? current : "unavailable"));
          }
          // 403, 404, 410: the room's own sync ends the page.
        } catch {
          // Offline for a moment: keep showing what we have.
        }
      } while (again.current);
      busy.current = false;
    })();
  }, [code]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  // Polling only while there is no live link (always, in a local review without Realtime).
  useEffect(() => {
    if (link === "live") return;
    const id = window.setInterval(refresh, realtime ? POLL_LIVE_FALLBACK_MS : POLL_NO_REALTIME_MS);
    return () => window.clearInterval(id);
  }, [link, realtime, refresh]);

  return { messages, pinned, status, loadedAtId, refresh };
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
