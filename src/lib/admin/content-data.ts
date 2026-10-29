import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLogger } from "@/lib/log";
import type { Localized } from "@/lib/i18n/localized";
import { announcementLive } from "./content-forms";
import { pendingColumns } from "./translation";

/**
 * The content editor's loaders (server only, uncached, service role): every
 * announcement including drafts and expired ones, which the public loader
 * leaves out. Callers check the role first (`requireEditor`).
 */

const log = createLogger("admin");

export interface AdminAnnouncement {
  id: string;
  title: Localized;
  body: Localized;
  /** The Markdown per language; empty for rows written as HTML (the seed). */
  bodySource: Localized;
  pinned: boolean;
  published: boolean;
  publishedAt: string;
  expiresAt: string | null;
  updatedAt: string;
  /** Columns the pipeline still has to translate. */
  pending: string[];
  /** On Home now, a draft, or past its end. */
  state: "live" | "draft" | "expired";
}

type Row = Record<string, unknown>;

function mapAnnouncement(row: Row, now: number): AdminAnnouncement {
  const published = row.published !== false;
  const expiresAt = row.expires_at ? String(row.expires_at) : null;
  return {
    id: String(row.id),
    title: (row.title ?? {}) as Localized,
    body: (row.body ?? {}) as Localized,
    bodySource: (row.body_source ?? {}) as Localized,
    pinned: Boolean(row.pinned),
    published,
    publishedAt: String(row.published_at ?? ""),
    expiresAt,
    updatedAt: String(row.updated_at ?? ""),
    pending: pendingColumns("announcements", row),
    state: !published ? "draft" : announcementLive({ published, expiresAt }, now) ? "live" : "expired",
  };
}

/** Every announcement, pinned first, newest first; null when the database can't be read. */
export async function listAnnouncements(): Promise<AdminAnnouncement[] | null> {
  if (!isSupabaseAdminConfigured()) return null;
  // `*`: body_source arrives with migration 0020, and the list must work before it.
  const { data, error } = await createAdminClient()
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) {
    log.error("Reading announcements failed", { error: error.message, code: error.code });
    return null;
  }
  const now = Date.now();
  return (data ?? []).map((row) => mapAnnouncement(row, now));
}

export async function getAnnouncementForEditing(id: string): Promise<AdminAnnouncement | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().from("announcements").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Reading an announcement failed", { error: error.message, code: error.code });
    return null;
  }
  return data ? mapAnnouncement(data, Date.now()) : null;
}
