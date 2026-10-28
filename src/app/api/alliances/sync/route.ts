// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { syncAlliances } from "@/lib/alliances/sync";
import { isAuthorized } from "@/lib/api-auth";
import { CACHE_TAGS } from "@/lib/data";
import { createLogger, requestId } from "@/lib/log";

/**
 * POST /api/alliances/sync
 *
 * The daily alliance sync (Maintenance workflow, task `alliances`): tag, name,
 * power, leader and members of every alliance on the list from MightPulse.
 * Protected by the same secret as /api/translate, so it needs no new one, and
 * the MightPulse key stays in Vercel. Answers 503 when MightPulse (or the
 * database) couldn't be reached, so the scheduled run fails visibly; the
 * alliances then stay as they were.
 */

export const maxDuration = 120;

const log = createLogger("alliances");

export async function POST(request: Request) {
  const reqId = requestId(request);
  const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json({ ...body, reqId }, { status, headers: { "x-request-id": reqId } });

  if (!isAuthorized(request)) {
    log.warn("Unauthorized call", { reqId });
    return reply({ error: "unauthorized" }, 401);
  }

  const result = await syncAlliances({ actor: null });
  if (result.status !== "synced") {
    log.warn("Alliance sync did not run", { reqId, status: result.status });
    return reply({ ok: false, ...result }, 503);
  }
  revalidateTag(CACHE_TAGS.alliances, { expire: 0 });
  // A new tag also changed the battle plans' coordinators and rally leaders (database trigger, 0017).
  if (result.renamed.length > 0) revalidateTag(CACHE_TAGS.kvk, { expire: 0 });
  return reply({ ok: true, ...result });
}
