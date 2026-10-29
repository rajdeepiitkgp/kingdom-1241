// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/api-auth";
import { expiryWindow } from "@/lib/content/expiry";
import { CACHE_TAGS } from "@/lib/data";
import { syncGiftCodes } from "@/lib/gift-codes/sync";
import { createLogger, requestId } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";

/**
 * POST /api/gift-codes/sync
 *
 * The hourly gift-code check (the Gift codes workflow): kingshot.net's list of
 * working codes into the gift_codes table. Protected by the same secret as
 * /api/translate, so it needs no new one. Home is rebuilt only when a code
 * came, changed or ended. When kingshot.net doesn't answer, the codes stay as
 * they were and the run passes; it fails (503, GitHub e-mails the owner) once
 * kingshot.net has failed for six hours, or when the database is the problem.
 *
 * The same hourly run takes an announcement or a gift code that just ran out
 * off Home: the pages are refreshed once a day (cacheLife "content"), so
 * without it an expired text would stay up to a day.
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
  const expired = await expiredRecently(reqId);
  if (expired.announcements) revalidateTag(CACHE_TAGS.announcements, { expire: 0 });
  if (expired.giftCodes || (result.status === "synced" && result.changed)) revalidateTag(CACHE_TAGS.giftCodes, { expire: 0 });
  if (result.status === "synced") return reply({ ok: true, ...result, expired });
  const quiet = result.status === "unavailable" && !result.stale;
  log.warn("Gift-code check did not run", { reqId, status: result.status, quiet });
  return reply({ ok: false, ...result }, quiet ? 200 : 503);
}

/** Whether an announcement or a gift code reached its expiry in the last two hours (never throws: a failed look just waits for the next run). */
async function expiredRecently(reqId: string): Promise<{ announcements: boolean; giftCodes: boolean }> {
  if (!isSupabaseAdminConfigured()) return { announcements: false, giftCodes: false };
  const { from, to } = expiryWindow(new Date());
  const admin = createAdminClient();
  const count = async (table: "announcements" | "gift_codes") => {
    const { count, error } = await admin.from(table).select("id", { count: "exact", head: true }).gt("expires_at", from).lte("expires_at", to);
    if (error) log.warn("Checking for expired texts failed", { reqId, table, error: error.message });
    return (count ?? 0) > 0;
  };
  const [announcements, giftCodes] = await Promise.all([count("announcements"), count("gift_codes")]);
  return { announcements, giftCodes };
}
