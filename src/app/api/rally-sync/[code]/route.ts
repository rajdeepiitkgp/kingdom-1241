// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { NextResponse } from "next/server";
import { createLogger, requestId } from "@/lib/log";
import { findOpenRoom, hasRoomAccess, roomState } from "@/lib/rally-sync/session";

/**
 * GET /api/rally-sync/{code}
 *
 * The current state of a Rally Sync room for a visitor who unlocked it (room
 * cookie): settings, hit time, leaders and the server's clock (the page
 * corrects its countdown with it). Open pages call it after a Realtime ping,
 * when they come back on screen and every few minutes; each call counts as
 * somebody looking at the room, which keeps it from closing.
 *
 *   404 { error: "missing" }   no such room
 *   410 { error: "closed" }    closed for inactivity or destroyed
 *   403 { error: "locked" }    no cookie, or the password changed
 *   503 { error: "unavailable" }
 */

const log = createLogger("rally-sync");

const STATUS = { missing: 404, closed: 410, unavailable: 503 } as const;

export async function GET(request: Request, ctx: RouteContext<"/api/rally-sync/[code]">) {
  const reqId = requestId(request);
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "x-request-id": reqId, "cache-control": "no-store" } });

  const { code } = await ctx.params;
  const found = await findOpenRoom(code);
  if ("problem" in found) return reply({ error: found.problem }, STATUS[found.problem]);
  if (!(await hasRoomAccess(found.room))) return reply({ error: "locked" }, 403);
  try {
    return reply(await roomState(found.store, found.room));
  } catch (error) {
    log.error("Could not load a room", { reqId, room: found.room.code, error: error instanceof Error ? error.message : String(error) });
    return reply({ error: "unavailable" }, 503);
  }
}
