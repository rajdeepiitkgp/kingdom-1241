import { describe, expect, it } from "vitest";
import { heartbeatFrame, joinFrame, readFrame, realtimeSocketUrl } from "@/lib/rally-sync/realtime";

describe("rally sync realtime frames", () => {
  const topic = "rally:abc";

  it("connects to the project's websocket with the publishable key", () => {
    expect(realtimeSocketUrl("https://ref.supabase.co/", "sb_publishable_x")).toBe("wss://ref.supabase.co/realtime/v1/websocket?apikey=sb_publishable_x&vsn=1.0.0");
  });

  it("joins the public topic for broadcasts only", () => {
    const frame = JSON.parse(joinFrame(topic, "1"));
    expect(frame).toMatchObject({ topic: "realtime:rally:abc", event: "phx_join", ref: "1", join_ref: "1" });
    expect(frame.payload.config.private).toBe(false);
    expect(JSON.parse(heartbeatFrame("7"))).toEqual({ topic: "phoenix", event: "heartbeat", payload: {}, ref: "7" });
  });

  it("reads the join reply, pings and channel errors for this topic only", () => {
    const frame = (value: unknown) => JSON.stringify(value);
    expect(readFrame(frame({ topic: "realtime:rally:abc", event: "phx_reply", ref: "1", payload: { status: "ok" } }), topic, "1")).toEqual({ kind: "joined" });
    expect(readFrame(frame({ topic: "realtime:rally:abc", event: "phx_reply", ref: "1", payload: { status: "error" } }), topic, "1")).toEqual({ kind: "join_failed" });
    // A heartbeat reply has another ref and topic.
    expect(readFrame(frame({ topic: "phoenix", event: "phx_reply", ref: "2", payload: { status: "ok" } }), topic, "1")).toEqual({ kind: "other" });
    expect(readFrame(frame({ topic: "realtime:rally:abc", event: "broadcast", payload: { event: "changed", payload: {} } }), topic, "1")).toEqual({ kind: "ping", event: "changed" });
    expect(readFrame(frame({ topic: "realtime:rally:other", event: "broadcast", payload: { event: "changed" } }), topic, "1")).toEqual({ kind: "other" });
    expect(readFrame(frame({ topic: "realtime:rally:abc", event: "phx_error", payload: {} }), topic, "1")).toEqual({ kind: "channel_closed" });
    expect(readFrame("garbage", topic, "1")).toEqual({ kind: "other" });
  });
});
