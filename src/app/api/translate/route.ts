import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { isAuthorized } from "@/lib/api-auth";
import { CACHE_TAGS, cacheTagForTable } from "@/lib/data";
import { createLogger, elapsedMs, requestId, type Logger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { isTranslationConfigured, translationProvider } from "@/lib/translate/provider";
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
 * Every log line and response carries `reqId` for tracing in the Vercel logs.
 */

export const maxDuration = 300;

const baseLog = createLogger("translate");

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
  const reqId = requestId(request);
  const started = performance.now();
  const log = baseLog.child({ reqId });
  const reply = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json({ ...body, reqId }, { status, headers: { "x-request-id": reqId } });

  if (!isAuthorized(request)) {
    log.warn("Unauthorized webhook call");
    return reply({ error: "unauthorized" }, 401);
  }

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return reply({ error: "invalid JSON body" }, 400);
  }

  const table = payload.table?.trim();
  if (!table) return reply({ error: "missing table" }, 400);

  const tag = cacheTagForTable(table);
  const config = getTranslatableTable(table);

  // Deletes and non-translatable tables only need a cache refresh.
  if (payload.type === "DELETE" || !config) {
    revalidate(tag, log);
    log.info("Revalidated only", { table, type: payload.type ?? "manual" });
    return reply({ ok: true, action: "revalidated", table });
  }

  if (!isSupabaseAdminConfigured()) {
    revalidate(tag, log);
    log.error("SUPABASE_SECRET_KEY is not configured");
    return reply({ ok: false, error: "SUPABASE_SECRET_KEY is not configured" }, 500);
  }
  if (!isTranslationConfigured()) {
    // Translation switched off (or no provider key): still refresh the cache so edits show up.
    revalidate(tag, log);
    log.info("Translation is off, revalidated only", { table, provider: translationProvider() });
    return reply({ ok: true, action: "revalidated", table, translation: "off" });
  }

  const id = payload.id ?? (payload.record ? (payload.record[config.primaryKey] as string | undefined) : undefined);

  if (table !== "site_settings" && !id) {
    return reply({ error: "missing record id" }, 400);
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
      revalidate(tag, log);
      log.info("Row unchanged, revalidated only", { table, id });
      return reply({ ok: true, action: "unchanged", table, id });
    }
  }

  after(async () => {
    try {
      const supabase = createAdminClient();
      const locales = await getEnabledLocalesForTranslation(supabase);
      const options = { force: payload.force, log: (message: string) => log.debug(message) };
      let results: TranslateRowResult[];

      if (table === "site_settings" && !id) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        results = await translateRows(supabase, table, data ?? [], locales, options);
      } else {
        const { data, error } = await supabase.from(table).select("*").eq(config.primaryKey, id!).maybeSingle();
        if (error) throw error;
        if (!data) {
          log.warn("Row not found (deleted?)", { table, id });
          revalidate(tag, log);
          return;
        }
        results = [await translateRow(supabase, table, data, locales, options)];
      }

      const didWrite = results.some((r) => !r.skipped);
      log.info("Translation finished", {
        table,
        id: id ?? "*",
        ms: elapsedMs(started),
        translated: results.filter((r) => !r.skipped).length,
        skipped: results.filter((r) => r.skipped).map((r) => r.reason ?? "?"),
      });
      revalidate(tag, log);
      if (didWrite) revalidate(CACHE_TAGS.all, log);
    } catch (error) {
      log.error("Translation failed", { table, id: id ?? "*", ms: elapsedMs(started), error });
      revalidate(tag, log);
    }
  });

  return reply({ ok: true, action: "scheduled", table, id: id ?? null }, 202);
}

function revalidate(tag: string | null, log: Logger) {
  try {
    revalidateTag(tag ?? CACHE_TAGS.all, { expire: 0 });
  } catch (error) {
    log.error("revalidateTag failed", { tag, error });
  }
}
