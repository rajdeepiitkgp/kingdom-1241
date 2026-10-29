// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { SupabaseClient } from "@supabase/supabase-js";
import { IMAGE_BUCKET, ORPHAN_GRACE_MS, referencedImagePaths } from "./images";

/**
 * The editor's images in the database (server only, framework-free so the
 * prune script can import it): how much space they take, and the daily
 * clean-up of images no text refers to any more (taken out of a text, or the
 * text deleted), once they are a day old so a text being written keeps its
 * fresh uploads.
 */

/** The tables whose texts may hold images, and the columns to look in (every language). */
const TEXT_COLUMNS: Record<string, readonly string[]> = {
  announcements: ["body", "body_source"],
  rules: ["body", "body_source"],
  guides: ["body", "body_source", "cover_image_url"],
  guide_sections: ["body", "body_source"],
};

const PAGE = 1000;

/** The table isn't there yet (migration 0020 not applied). */
export function missingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Reads a whole table page by page (the API returns at most 1000 rows per request). */
async function readAll(admin: SupabaseClient, table: string, columns: string): Promise<{ rows: Record<string, unknown>[]; error: { code?: string; message: string } | null }> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) return { rows, error };
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < PAGE) return { rows, error: null };
  }
}

/** Bytes all content images take, or null while the table is missing. */
export async function usedImageBytes(admin: SupabaseClient): Promise<number | null> {
  const { rows, error } = await readAll(admin, "content_images", "bytes");
  if (missingTable(error)) return null;
  if (error) throw new Error(`Could not read the image list: ${error.message}`);
  return rows.reduce((sum, row) => sum + Number(row.bytes ?? 0), 0);
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).filter((v): v is string => typeof v === "string");
  return [];
}

/** Which images to delete: older than the grace period and in no text (pure). */
export function unusedImages(images: ReadonlyArray<{ path: string; createdAt: string }>, referenced: ReadonlySet<string>, now: Date): string[] {
  const cutoff = now.getTime() - ORPHAN_GRACE_MS;
  return images.filter((image) => !referenced.has(image.path) && Date.parse(image.createdAt) < cutoff).map((image) => image.path);
}

/** Deletes the unused images (files and rows); returns what was (or would be, with `dryRun`) deleted. */
export async function pruneUnusedImages(admin: SupabaseClient, now: Date, options: { dryRun?: boolean } = {}): Promise<{ deleted: number; bytes: number }> {
  const images = await readAll(admin, "content_images", "path, bytes, created_at");
  if (missingTable(images.error)) return { deleted: 0, bytes: 0 };
  if (images.error) throw new Error(`Could not read the image list: ${images.error.message}`);

  const texts: string[] = [];
  for (const [table, columns] of Object.entries(TEXT_COLUMNS)) {
    const { rows, error } = await readAll(admin, table, columns.join(", "));
    // A table that isn't there yet (its migration still to come) holds no texts.
    if (missingTable(error)) continue;
    // Never delete on a partial picture: a text that couldn't be read may hold the image.
    if (error) throw new Error(`Could not read ${table} to find the images in use: ${error.message}`);
    for (const row of rows) for (const column of columns) texts.push(...strings(row[column]));
  }

  const unused = unusedImages(
    images.rows.map((row) => ({ path: String(row.path), createdAt: String(row.created_at) })),
    referencedImagePaths(texts),
    now,
  );
  const sizes = new Map(images.rows.map((row) => [String(row.path), Number(row.bytes ?? 0)]));
  const bytes = unused.reduce((sum, path) => sum + (sizes.get(path) ?? 0), 0);
  if (options.dryRun || unused.length === 0) return { deleted: unused.length, bytes };

  for (let i = 0; i < unused.length; i += 100) {
    const batch = unused.slice(i, i + 100);
    // Files first: a row without its file only undercounts the space; a file without its row would never be cleaned up.
    const { error: removeError } = await admin.storage.from(IMAGE_BUCKET).remove(batch);
    if (removeError) throw new Error(`Could not delete unused images: ${removeError.message}`);
    const { error: rowError } = await admin.from("content_images").delete().in("path", batch);
    if (rowError) throw new Error(`Could not delete the rows of unused images: ${rowError.message}`);
  }
  return { deleted: unused.length, bytes };
}
