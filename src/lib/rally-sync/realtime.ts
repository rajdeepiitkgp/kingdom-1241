// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * A minimal Supabase Realtime client for one public broadcast topic (browser).
 * supabase-js stays out of the browser bundle (see the client-boundary test);
 * the room page only needs "something changed", so this speaks the Phoenix
 * channel protocol (vsn 1.0.0, JSON frames) directly: join, heartbeat every
 * 25 s, reconnect with backoff. The frames carry no room data: the database
 * triggers of migration 0012 send `changed` or `closed`, and the page refetches.
 */

export type LinkStatus = "connecting" | "live" | "offline";

export function realtimeSocketUrl(supabaseUrl: string, apiKey: string): string {
  return `${supabaseUrl.replace(/^http/, "ws").replace(/\/$/, "")}/realtime/v1/websocket?apikey=${encodeURIComponent(apiKey)}&vsn=1.0.0`;
}

export function joinFrame(topic: string, ref: string): string {
  return JSON.stringify({
    topic: `realtime:${topic}`,
    event: "phx_join",
    payload: { config: { broadcast: { ack: false, self: false }, presence: { key: "", enabled: false }, postgres_changes: [], private: false } },
    ref,
    join_ref: ref,
  });
}

export function heartbeatFrame(ref: string): string {
  return JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref });
}

export type ServerFrame = { kind: "joined" } | { kind: "join_failed" } | { kind: "ping"; event: string } | { kind: "channel_closed" } | { kind: "other" };

/** What a frame from the server means for `topic`. */
export function readFrame(raw: unknown, topic: string, joinRef: string): ServerFrame {
  let frame: { topic?: unknown; event?: unknown; ref?: unknown; payload?: { status?: unknown; event?: unknown } };
  try {
    frame = JSON.parse(String(raw)) as typeof frame;
  } catch {
    return { kind: "other" };
  }
  if (frame.topic !== `realtime:${topic}`) return { kind: "other" };
  if (frame.event === "phx_reply" && frame.ref === joinRef) return frame.payload?.status === "ok" ? { kind: "joined" } : { kind: "join_failed" };
  if (frame.event === "broadcast" && typeof frame.payload?.event === "string") return { kind: "ping", event: frame.payload.event };
  if (frame.event === "phx_close" || frame.event === "phx_error") return { kind: "channel_closed" };
  return { kind: "other" };
}

const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000];
const HEARTBEAT_MS = 25_000;
/** No frame at all for this long (heartbeat replies included) means the link is dead. */
const SILENCE_MS = 65_000;

export interface RoomChannelOptions {
  url: string;
  apiKey: string;
  topic: string;
  onPing: (event: string) => void;
  onStatus: (status: LinkStatus) => void;
}

/** Connects and keeps the subscription alive until the returned function is called. */
export function connectRoomChannel({ url, apiKey, topic, onPing, onStatus }: RoomChannelOptions): () => void {
  let socket: WebSocket | null = null;
  let disposed = false;
  let attempt = 0;
  let ref = 0;
  let joinRef = "";
  let heartbeat: number | undefined;
  let retry: number | undefined;
  let lastFrameAt = Date.now();

  const stopTimers = () => {
    window.clearInterval(heartbeat);
    window.clearTimeout(retry);
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    stopTimers();
    onStatus("offline");
    retry = window.setTimeout(open, BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]);
  };

  function open() {
    if (disposed) return;
    // Also reached from the browser's `online` event while a socket is up: its heartbeat and a pending retry go with it.
    stopTimers();
    socket?.close();
    onStatus("connecting");
    const ws = new WebSocket(realtimeSocketUrl(url, apiKey));
    socket = ws;
    ws.onopen = () => {
      joinRef = String(++ref);
      lastFrameAt = Date.now();
      ws.send(joinFrame(topic, joinRef));
      heartbeat = window.setInterval(() => {
        if (Date.now() - lastFrameAt > SILENCE_MS) {
          ws.close();
          return;
        }
        ws.send(heartbeatFrame(String(++ref)));
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (message) => {
      lastFrameAt = Date.now();
      const frame = readFrame(message.data, topic, joinRef);
      if (frame.kind === "joined") {
        attempt = 0;
        onStatus("live");
      } else if (frame.kind === "ping") {
        onPing(frame.event);
      } else if (frame.kind === "join_failed" || frame.kind === "channel_closed") {
        ws.close();
      }
    };
    ws.onclose = () => {
      if (socket === ws) scheduleReconnect();
    };
  }

  const onOnline = () => {
    attempt = 0;
    open();
  };
  window.addEventListener("online", onOnline);
  open();

  return () => {
    disposed = true;
    stopTimers();
    window.removeEventListener("online", onOnline);
    const ws = socket;
    socket = null;
    ws?.close();
  };
}
