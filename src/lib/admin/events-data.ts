import { mapEvent } from "@/lib/data/mappers";
import type { GameEvent } from "@/lib/data/types";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { pendingColumns } from "./translation";

/**
 * The events editor's loaders (server only, uncached, service role): every
 * event, the hidden ones included. Callers check the role first (`requireEditor`).
 */

const log = createLogger("admin");

export interface AdminEvent extends GameEvent {
  /** Columns the pipeline still has to translate. */
  pending: string[];
}

function mapAdminEvent(row: Record<string, unknown>): AdminEvent {
  return { ...mapEvent(row), pending: pendingColumns("events", row) };
}

/** Every event, in the order of its first start; null when the database can't be read. */
export async function listEvents(): Promise<AdminEvent[] | null> {
  if (!isSupabaseAdminConfigured()) return null;
  // `*`: timing and also_after_days arrive with migration 0022, and the list must work before it.
  const { data, error } = await createAdminClient().from("events").select("*").order("starts_at").order("created_at");
  if (error) {
    log.error("Reading the events failed", { error: error.message, code: error.code });
    return null;
  }
  return (data ?? []).map(mapAdminEvent);
}

export async function getEventForEditing(id: string): Promise<AdminEvent | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("events").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Reading an event failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapAdminEvent(data) : null;
}
