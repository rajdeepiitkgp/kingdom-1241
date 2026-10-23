import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/api-auth";
import { CACHE_TAGS, cacheTagForTable } from "@/lib/data";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { isGeminiConfigured } from "@/lib/translate/gemini";
import { getTranslatableTable } from "@/lib/translate/tables";
import { getEnabledLocalesForTranslation, translateRow, translateRows, type TranslateRowResult } from "@/lib/translate/translate-row";

/**
 * POST /api/translate
 *
 * Called by Supabase Database Webhooks whenever a content row is inserted or
 * updated (see SETUP.md). Translates the row's English text into every
 * enabled language with Gemini — and only then. Pages never call this.
 *
 * Accepted bodies:
 *   - Supabase webhook payload: { type, table, schema, record, old_record }
 *   - Manual:                   { table, id }   or   { table: "site_settings" }
 *
 * The response is sent immediately; translation runs after the response so
 * the webhook never times out. The page cache is refreshed when it finishes.
 */

export const maxDuration = 300;

interface WebhookPayload {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  schema?: string;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
  id?: string;
  force?: boolean;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const table = payload.table?.trim();
  if (!table) return NextResponse.json({ error: "missing table" }, { status: 400 });

  const tag = cacheTagForTable(table);
  const config = getTranslatableTable(table);

  // Deletes and non-translatable tables only need a cache refresh.
  if (payload.type === "DELETE" || !config) {
    revalidate(tag);
    return NextResponse.json({ ok: true, action: "revalidated", table });
  }

  if (!isSupabaseAdminConfigured()) {
    revalidate(tag);
    return NextResponse.json({ ok: false, error: "SUPABASE_SECRET_KEY is not configured" }, { status: 500 });
  }
  if (!isGeminiConfigured()) {
    revalidate(tag);
    return NextResponse.json({ ok: false, error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const id = payload.id ?? (payload.record ? (payload.record[config.primaryKey] as string | undefined) : undefined);

  if (table !== "site_settings" && !id) {
    return NextResponse.json({ error: "missing record id" }, { status: 400 });
  }

  // Cheap short-circuit for webhook loops: an UPDATE that didn't touch any
  // translatable column (e.g. our own write of source_hash + translations) is
  // handled by the hash check inside translateRow, but we can skip the
  // round-trip entirely when only `updated_at` changed.
  if (payload.type === "UPDATE" && payload.record && payload.old_record) {
    const changed = [...config.columns.map((c) => c.name), "source_hash"].some(
      (column) => JSON.stringify(payload.record?.[column]) !== JSON.stringify(payload.old_record?.[column]),
    );
    if (!changed) {
      revalidate(tag);
      return NextResponse.json({ ok: true, action: "unchanged", table, id });
    }
  }

  after(async () => {
    try {
      const supabase = createAdminClient();
      const locales = await getEnabledLocalesForTranslation(supabase);
      let results: TranslateRowResult[];

      if (table === "site_settings" && !id) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        results = await translateRows(supabase, table, data ?? [], locales, { force: payload.force, log: console.log });
      } else {
        const { data, error } = await supabase.from(table).select("*").eq(config.primaryKey, id!).maybeSingle();
        if (error) throw error;
        if (!data) {
          console.warn(`[translate] ${table}/${id} not found (deleted?)`);
          revalidate(tag);
          return;
        }
        results = [await translateRow(supabase, table, data, locales, { force: payload.force, log: console.log })];
      }

      const didWrite = results.some((r) => !r.skipped);
      console.log(`[translate] ${table}/${id ?? "*"}: ${results.map((r) => (r.skipped ? `skipped (${r.reason})` : r.translated.join(","))).join("; ")}`);
      revalidate(tag);
      if (didWrite) revalidate(CACHE_TAGS.all);
    } catch (error) {
      console.error(`[translate] ${table}/${id ?? "*"} failed`, error);
      revalidate(tag);
    }
  });

  return NextResponse.json({ ok: true, action: "scheduled", table, id: id ?? null }, { status: 202 });
}

function revalidate(tag: string | null) {
  try {
    revalidateTag(tag ?? CACHE_TAGS.all, { expire: 0 });
  } catch (error) {
    console.error("[translate] revalidateTag failed", error);
  }
}
