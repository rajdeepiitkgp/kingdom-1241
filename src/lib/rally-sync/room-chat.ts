// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { MINUTE } from "@/lib/time";
import type { LockoutPolicy } from "@/lib/kvk/throttle";
import { instanceLabel } from "./room";
import type { SoundCue } from "./timing";

/**
 * The room chat (pure, unit-tested; storage in store.ts, the rules repeated
 * in migration 0025). Plain text between everyone in a room: a question, a
 * called change, "ready". Nothing is translated: a message stays in the
 * language it was written in, and the browser's own page translation may
 * translate it. Messages die with the room, and a room keeps the last
 * CHAT_KEEP. Realtime carries a content-free "chat" ping; pages fetch the
 * messages after the last one they have through the cookie-checked route.
 * The page opens it from a floating button like a messenger (a window on a
 * laptop, a sheet on a phone), and a soft pop announces a new message when
 * sound is on, except around the device's own countdown cues (chimeQuiet).
 */

export const CHAT_BODY_MAX = 500;
/** Messages a room keeps (the database trims the oldest; the page shows these). */
export const CHAT_KEEP = 100;
/** Messages a browser may send per minute; past it the browser waits a minute (shaped like the wrong-password rules). */
export const CHAT_PER_MINUTE = 20;
export const CHAT_POLICY: LockoutPolicy = { window: MINUTE, maxFailures: CHAT_PER_MINUTE, firstLock: MINUTE, maxLock: MINUTE };

/** One message as the page sees it: never an instance id, only whether it is the reader's own. */
export interface MessageView {
  id: number;
  /** The sender's name at the time (own name, else its leaders' names); null for a watcher, shown as "Watcher" + tag. */
  author: string | null;
  tag: string;
  /** Sent with coordinator rights. */
  coordinator: boolean;
  body: string;
  /** When it was sent (ISO). */
  at: string;
  mine: boolean;
  /** The coordinator pinned it: one per room, on top of the chat and under the room's status line. */
  pinned: boolean;
}

/**
 * The answer of GET /api/rally-sync/[code]/chat?after=<id>: the messages after
 * that id, the oldest id the room still holds (null: none) and the pinned
 * message, whole, whatever its age (so a pin on an old message reaches a page
 * that already has it).
 */
export interface ChatState {
  messages: MessageView[];
  oldest: number | null;
  pinned: MessageView | null;
  serverNow: number;
}

/** A message as typed: trimmed, inner blank lines collapsed, 1–500 characters; null when it can't be sent. */
export function parseMessageBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const body = value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return body.length >= 1 && body.length <= CHAT_BODY_MAX ? body : null;
}

/** What a message carries as its sender: the browser's label at the time it was sent (instanceLabel), a watcher by its tag alone. */
export function messageAuthor(instance: { name: string | null; tag: string }, leaderNames: readonly string[]): { author: string | null; tag: string } {
  const label = instanceLabel({ name: instance.name, leaders: [...leaderNames], tag: instance.tag });
  return { author: label.kind === "watcher" ? null : label.text, tag: instance.tag };
}

/** The list after a fetch: the new messages added in order, duplicates dropped, only the last `keep` kept. */
export function mergeMessages<T extends { id: number }>(current: readonly T[], incoming: readonly T[], keep = CHAT_KEEP): T[] {
  const byId = new Map<number, T>();
  for (const message of [...current, ...incoming]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-keep);
}

/**
 * The page's list after a fetch: the new messages merged in, and anything the
 * room no longer holds dropped (the coordinator cleared the chat, or the room
 * trimmed its oldest), so the page always shows what the room has.
 */
export function applyChatFetch(current: readonly MessageView[], fetched: Pick<ChatState, "messages" | "oldest" | "pinned">): MessageView[] {
  const merged = mergeMessages(current, fetched.messages);
  const kept = fetched.oldest === null ? [] : merged.filter((m) => m.id >= fetched.oldest!);
  return withPinned(kept, fetched.pinned?.id ?? null);
}

/** The list with exactly one message pinned (the room's), or none. */
export function withPinned<T extends { id: number; pinned: boolean }>(messages: readonly T[], pinnedId: number | null): T[] {
  return messages.map((m) => (m.pinned === (m.id === pinnedId) ? m : { ...m, pinned: m.id === pinnedId }));
}

/** A message id from a coordinator's request: a positive whole number, else null. */
export function parseMessageId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** The id to ask for the next messages after (0 before the first fetch). */
export function lastMessageId(messages: ReadonlyArray<{ id: number }>): number {
  return messages.length > 0 ? messages[messages.length - 1].id : 0;
}

/** Messages from others that arrived after the chat was last looked at (`seenId`: the newest id seen then). */
export function unreadCount(messages: ReadonlyArray<{ id: number; mine: boolean }>, seenId: number): number {
  return messages.filter((m) => m.id > seenId && !m.mine).length;
}

/** The newest message from someone else (0 when there is none): a new one chimes. */
export function lastOtherMessageId(messages: ReadonlyArray<{ id: number; mine: boolean }>): number {
  return messages.reduce((latest, m) => (!m.mine && m.id > latest ? m.id : latest), 0);
}

/** How close a rally or refill cue may be before a chat message stays silent, so a pop is never taken for a countdown beep. */
export const CHIME_QUIET_MS = MINUTE;

/**
 * Whether a new message must stay silent: a countdown cue of this device
 * (the chime a minute before its start, the beeps to GO, a garrison send or
 * speedup) lies within the next minute or has just sounded. `cues` null
 * means no cues at all (sound off, no start): never quiet for that reason.
 */
export function chimeQuiet(cues: readonly SoundCue[] | null, now: number): boolean {
  return cues !== null && cues.some((cue) => cue.at > now - 5_000 && cue.at < now + CHIME_QUIET_MS);
}

/** The chat's folded line: the newest message, shortened ("Rudy: on my way…"). */
export function previewOf(message: { body: string } | undefined, max = 60): string | null {
  if (!message) return null;
  const line = message.body.replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
