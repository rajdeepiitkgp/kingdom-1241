// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { chargeTry, type ThrottleState } from "@/lib/kvk/throttle";
import {
  applyChatFetch,
  CHAT_BODY_MAX,
  CHAT_KEEP,
  CHAT_PER_MINUTE,
  CHAT_POLICY,
  chimeQuiet,
  lastMessageId,
  lastOtherMessageId,
  mergeMessages,
  messageAuthor,
  type MessageView,
  parseMessageBody,
  parseMessageId,
  previewOf,
  unreadCount,
  withPinned,
} from "@/lib/rally-sync/room-chat";
import { refillCues } from "@/lib/rally-sync/garrison";
import { soundCues } from "@/lib/rally-sync/timing";

const message = (id: number, extra: Partial<MessageView> = {}): MessageView => ({ id, author: "Rudy", tag: "K7M4", coordinator: false, body: `m${id}`, at: "2026-11-09T20:00:00.000Z", mine: false, pinned: false, ...extra });

describe("room chat messages", () => {
  it("takes 1–500 characters of plain text, trimmed, with blank lines collapsed", () => {
    expect(parseMessageBody("  on my way  ")).toBe("on my way");
    expect(parseMessageBody("a\r\n\r\n\r\n\r\nb  \nc")).toBe("a\n\nb\nc");
    expect(parseMessageBody("")).toBeNull();
    expect(parseMessageBody("   \n ")).toBeNull();
    expect(parseMessageBody("x".repeat(CHAT_BODY_MAX))).toHaveLength(CHAT_BODY_MAX);
    expect(parseMessageBody("x".repeat(CHAT_BODY_MAX + 1))).toBeNull();
    expect(parseMessageBody(42)).toBeNull();
    expect(parseMessageBody(undefined)).toBeNull();
  });

  it("names the sender like the coordinator's list: own name, else its leaders, else the tag alone", () => {
    expect(messageAuthor({ name: "Proxy", tag: "K7M4" }, ["Rudy"])).toEqual({ author: "Proxy", tag: "K7M4" });
    expect(messageAuthor({ name: null, tag: "K7M4" }, ["Rudy", "Mira"])).toEqual({ author: "Rudy, Mira", tag: "K7M4" });
    expect(messageAuthor({ name: null, tag: "K7M4" }, [])).toEqual({ author: null, tag: "K7M4" });
  });

  it("merges a fetch in order without duplicates and keeps the last CHAT_KEEP", () => {
    const current = [message(1), message(2), message(3)];
    expect(mergeMessages(current, [message(3, { body: "same" }), message(4)]).map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(mergeMessages([], [message(2), message(1)]).map((m) => m.id)).toEqual([1, 2]);
    const many = Array.from({ length: CHAT_KEEP + 5 }, (_, i) => message(i + 1));
    const kept = mergeMessages([], many);
    expect(kept).toHaveLength(CHAT_KEEP);
    expect(kept[0].id).toBe(6);
    expect(lastMessageId(kept)).toBe(CHAT_KEEP + 5);
    expect(lastMessageId([])).toBe(0);
  });

  it("drops what the room no longer holds: a cleared chat empties the page, a trimmed room drops the oldest", () => {
    const current = [message(1), message(2), message(3)];
    expect(applyChatFetch(current, { messages: [message(4)], oldest: 1, pinned: null }).map((m) => m.id)).toEqual([1, 2, 3, 4]);
    expect(applyChatFetch(current, { messages: [message(4)], oldest: 3, pinned: null }).map((m) => m.id)).toEqual([3, 4]);
    expect(applyChatFetch(current, { messages: [], oldest: null, pinned: null })).toEqual([]);
    // A fetch of everything (after 0) after a clear brings only the new ones.
    expect(applyChatFetch(current, { messages: [message(7)], oldest: 7, pinned: null }).map((m) => m.id)).toEqual([7]);
    // The pinned message comes whole with every fetch, so a pin on an old message reaches a page that already has it.
    expect(applyChatFetch(current, { messages: [], oldest: 1, pinned: message(2, { pinned: true }) }).map((m) => m.pinned)).toEqual([false, true, false]);
  });

  it("marks exactly the room's pinned message, and reads a message id only as a positive whole number", () => {
    const list = [message(1, { pinned: true }), message(2), message(3)];
    expect(withPinned(list, 3).map((m) => m.pinned)).toEqual([false, false, true]);
    expect(withPinned(list, null).map((m) => m.pinned)).toEqual([false, false, false]);
    // Unchanged messages keep their identity (no re-render for nothing).
    expect(withPinned(list, 1)[1]).toBe(list[1]);
    expect(parseMessageId(7)).toBe(7);
    expect(parseMessageId(0)).toBeNull();
    expect(parseMessageId(-1)).toBeNull();
    expect(parseMessageId(1.5)).toBeNull();
    expect(parseMessageId("7")).toBeNull();
  });

  it("counts messages from others after the last one seen as new; own messages never count", () => {
    const messages = [message(1), message(2, { mine: true }), message(3), message(4)];
    expect(unreadCount(messages, 0)).toBe(3);
    expect(unreadCount(messages, 2)).toBe(2);
    expect(unreadCount(messages, 4)).toBe(0);
  });

  it("finds the newest message from someone else, which is what pops", () => {
    expect(lastOtherMessageId([])).toBe(0);
    expect(lastOtherMessageId([message(1, { mine: true }), message(2, { mine: true })])).toBe(0);
    expect(lastOtherMessageId([message(1), message(2, { mine: true }), message(3)])).toBe(3);
  });

  it("stays silent while a countdown cue of the device is within a minute, or has just sounded", () => {
    const start = 1_700_000_000_000;
    const cues = soundCues(start); // a chime at start − 60 s, ticks at −5 … −1, GO at 0
    expect(chimeQuiet(null, start)).toBe(false);
    expect(chimeQuiet(cues, start - 130_000)).toBe(false);
    expect(chimeQuiet(cues, start - 100_000)).toBe(true); // the chime a minute before the start lies within the next minute
    expect(chimeQuiet(cues, start - 30_000)).toBe(true);
    expect(chimeQuiet(cues, start - 1_000)).toBe(true);
    expect(chimeQuiet(cues, start + 3_000)).toBe(true); // GO has just sounded
    expect(chimeQuiet(cues, start + 6_000)).toBe(false);
    // A garrison player's sends: quiet around each, free in between.
    const sends = refillCues([
      { kind: "send", sendAt: start, speedupAt: null },
      { kind: "send", sendAt: start + 300_000, speedupAt: null },
    ] as unknown as Parameters<typeof refillCues>[0]);
    expect(chimeQuiet(sends, start + 100_000)).toBe(false);
    expect(chimeQuiet(sends, start + 250_000)).toBe(true);
  });

  it("shortens the newest message for the folded line", () => {
    expect(previewOf(undefined)).toBeNull();
    expect(previewOf({ body: " on\n my   way " })).toBe("on my way");
    const long = previewOf({ body: "w".repeat(80) });
    expect(long).toHaveLength(60);
    expect(long?.endsWith("…")).toBe(true);
  });

  it("lets a browser send CHAT_PER_MINUTE messages a minute, then makes it wait a minute", () => {
    let state: ThrottleState | null = null;
    const now = 1_700_000_000_000;
    for (let i = 0; i < CHAT_PER_MINUTE; i++) {
      const charge = chargeTry(state, now + i * 1000, CHAT_POLICY);
      expect("next" in charge, `message ${i + 1}`).toBe(true);
      if ("next" in charge) state = charge.next;
    }
    const refused = chargeTry(state, now + CHAT_PER_MINUTE * 1000, CHAT_POLICY);
    expect("retryAt" in refused).toBe(true);
    if ("retryAt" in refused) expect(refused.retryAt).toBeLessThanOrEqual(now + (CHAT_PER_MINUTE - 1) * 1000 + 60_000);
    // A minute later the browser may write again.
    expect("next" in chargeTry(state, now + CHAT_PER_MINUTE * 1000 + 60_000, CHAT_POLICY)).toBe(true);
  });
});
