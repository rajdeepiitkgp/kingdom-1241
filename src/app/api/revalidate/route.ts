import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/api-auth";
import { CACHE_TAGS, cacheTagForTable, routesForTag } from "@/lib/data";
import { createLogger, requestId } from "@/lib/log";

/**
 * POST /api/revalidate   { "table": "announcements" }   (table optional)
 *
 * Refreshes the page cache after content changed without going through the
 * translation webhook (e.g. a manual edit in the Supabase table editor of a
 * non-translatable column, or after running the seed script).
 * Protected by the same secret as /api/translate.
 */

const log = createLogger("revalidate");

export async function POST(request: Request) {
  const reqId = requestId(request);
  const reply = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json({ ...body, reqId }, { status, headers: { "x-request-id": reqId } });

  if (!isAuthorized(request)) {
    log.warn("Unauthorized call", { reqId });
    return reply({ error: "unauthorized" }, 401);
  }

  let table: string | undefined;
  try {
    const body = (await request.json()) as { table?: string };
    table = body.table?.trim() || undefined;
  } catch {
    // No body → refresh everything.
  }

  const tag = table ? (cacheTagForTable(table) ?? CACHE_TAGS.all) : CACHE_TAGS.all;
  revalidateTag(tag, { expire: 0 });
  for (const route of routesForTag(tag)) revalidatePath(route, "page");
  log.info("Cache revalidated", { reqId, table: table ?? "*", tag });
  return reply({ ok: true, tag, now: Date.now() });
}
