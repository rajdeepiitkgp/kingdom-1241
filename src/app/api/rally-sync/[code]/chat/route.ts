// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { NextResponse } from "next/server";
import { createLogger, requestId } from "@/lib/log";
import { CHAT_KEEP, type ChatState, type MessageView } from "@/lib/rally-sync/room-chat";
import { findOpenRoom, roomAccess } from "@/lib/rally-sync/session";
import { RallyStoreError } from "@/lib/rally-sync/store";

/**
 * GET /api/rally-sync/{code}/chat?after={id}
 *
 * The room chat for a visitor who unlocked the room (room cookie): the messages
 * after `after` (0, or left out: every message the room keeps), oldest first,
 * each marked `mine` when this browser sent it, the oldest id the room still
 * holds (so a page can drop what the coordinator cleared) and the pinned
 * message, if any, whole. Open pages
 * call it after a Realtime "chat" ping, when they come back on screen and by
 * polling while the link is down; it never counts as looking at the room (the
 * state route does that).
 *
 *   404 { error: "missing" }   no such room
 *   410 { error: "closed" }    closed for inactivity or destroyed
 *   403 { error: "locked" }    no cookie, or the coordinator removed this browser
 *   503 { error: "unavailable" }   also before migration 0025 (no chat yet)
 */

const log = createLogger("rally-sync");

const STATUS = { missing: 404, closed: 410, unavailable: 503 } as const;

export async function GET(request: Request, ctx: RouteContext<"/api/rally-sync/[code]/chat">) {
  const reqId = requestId(request);
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "x-request-id": reqId, "cache-control": "no-store" } });

  const { code } = await ctx.params;
  const after = Number(new URL(request.url).searchParams.get("after") ?? "0");
  const afterId = Number.isSafeInteger(after) && after > 0 ? after : 0;
  const found = await findOpenRoom(code);
  if ("problem" in found) return reply({ error: found.problem }, STATUS[found.problem]);
  try {
    const access = await roomAccess(found.store, found.room);
    if (!access) return reply({ error: "locked" }, 403);
    const { store, room } = found;
    const [rows, first, pinned] = await Promise.all([store.messages(room.id, afterId, CHAT_KEEP), afterId > 0 ? store.messages(room.id, 0, 1) : null, store.pinnedMessage(room.id)]);
    const me = access.instance?.id ?? null;
    const view = (m: (typeof rows)[number]): MessageView => ({ id: m.id, author: m.author, tag: m.tag, coordinator: m.coordinator, body: m.body, at: m.createdAt, mine: me !== null && m.instanceId === me, pinned: m.pinned });
    const state: ChatState = {
      messages: rows.map(view),
      oldest: (first ?? rows)[0]?.id ?? null,
      pinned: pinned ? view(pinned) : null,
      serverNow: Date.now(),
    };
    return reply(state);
  } catch (error) {
    if (!(error instanceof RallyStoreError && error.problem === "not_migrated")) {
      log.error("Could not load a room chat", { reqId, room: found.room.code, error: error instanceof Error ? error.message : String(error) });
    }
    return reply({ error: "unavailable" }, 503);
  }
}
