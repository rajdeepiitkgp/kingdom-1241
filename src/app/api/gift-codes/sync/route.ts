// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/api-auth";
import { CACHE_TAGS } from "@/lib/data";
import { syncGiftCodes } from "@/lib/gift-codes/sync";
import { createLogger, requestId } from "@/lib/log";

/**
 * POST /api/gift-codes/sync
 *
 * The hourly gift-code check (the Gift codes workflow): kingshot.net's list of
 * working codes into the gift_codes table. Protected by the same secret as
 * /api/translate, so it needs no new one. Home is rebuilt only when a code
 * came, changed or ended. When kingshot.net doesn't answer, the codes stay as
 * they were and the run passes; it fails (503, GitHub e-mails the owner) once
 * kingshot.net has failed for six hours, or when the database is the problem.
 */

const log = createLogger("gift-codes");

export async function POST(request: Request) {
  const reqId = requestId(request);
  const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json({ ...body, reqId }, { status, headers: { "x-request-id": reqId } });

  if (!isAuthorized(request)) {
    log.warn("Unauthorized call", { reqId });
    return reply({ error: "unauthorized" }, 401);
  }

  const result = await syncGiftCodes({ actor: null });
  if (result.status === "synced") {
    if (result.changed) revalidateTag(CACHE_TAGS.giftCodes, { expire: 0 });
    return reply({ ok: true, ...result });
  }
  const quiet = result.status === "unavailable" && !result.stale;
  log.warn("Gift-code check did not run", { reqId, status: result.status, quiet });
  return reply({ ok: false, ...result }, quiet ? 200 : 503);
}
