import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/api-auth";
import { CACHE_TAGS, cacheTagForTable } from "@/lib/data";

/**
 * POST /api/revalidate   { "table": "announcements" }   (table optional)
 *
 * Refreshes the page cache after content changed without going through the
 * translation webhook (e.g. a manual edit in the Supabase table editor of a
 * non-translatable column, or after running the seed script).
 * Protected by the same secret as /api/translate.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  return NextResponse.json({ ok: true, tag, now: Date.now() });
}
