"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prepareRichText } from "@/components/content/RichText";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { missingTable, usedImageBytes } from "@/lib/content/image-store";
import { budgetProblem, IMAGE_BUCKET, IMAGE_MAX_BYTES, IMAGE_MIME, imagePath, imageProblem, imageUrl, isImageKind, sniffImage, stripJpegMetadata } from "@/lib/content/images";
import { getEnabledLocales } from "@/lib/data";
import { CACHE_TAGS, type CacheTag, routesForTag } from "@/lib/data/cache-tags";
import { markdownToHtml } from "@/lib/html";
import { isLocaleCode } from "@/lib/i18n/languages";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, supabaseUrl } from "@/lib/supabase/env";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { BODY_MAX, type ContentOrderTable, isContentOrderTable, parseAnnouncementForm, SUMMARY_MAX, TITLE_MAX } from "./content-forms";
import { bodyColumns, NO_DATABASE } from "./content-write";
import { localeField, localizedUpdate, textField, uuidField } from "./forms";
import { isMoveDirection, moveInList } from "./kvk-forms";
import { pendingColumns, withLanguage } from "./translation";

/**
 * Server Actions of the content editor (moderators and up): the editor's
 * preview and image upload, the announcements, the per-language corrections
 * and the order of every content list. Rules and guides have their own files
 * (rules-actions.ts, guides-actions.ts). Every write is audited and expires
 * the public page's cache.
 */

const GONE_ANNOUNCEMENT: ActionState = { status: "error", message: "This announcement no longer exists. Reload the page." };

/** The column arrived with migration 0020; until it is applied, rows are written without it. */
function missingColumn(error: { code?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

// ---------------------------------------------------------------------------
// The editor: preview and images
// ---------------------------------------------------------------------------

/** The text as players will see it: the same Markdown and sanitiser as the live page. */
export async function previewMarkdown(markdown: string): Promise<{ html: string } | { error: string }> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return { error: denied(access.denied).message ?? "" };
  if (typeof markdown !== "string") return { error: "Nothing to preview." };
  return { html: prepareRichText(markdownToHtml(markdown.slice(0, BODY_MAX))) };
}

export type UploadResult = { status: "saved"; url: string } | { status: "error"; message: string };

/** Stores one image the editor has shrunk; the editor puts the returned address into the text. */
export async function uploadContentImage(formData: FormData): Promise<UploadResult> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return { status: "error", message: denied(access.denied).message ?? "" };
  const log = await actionLogger();
  const file = formData.get("file");
  if (!(file instanceof File)) return { status: "error", message: "No image arrived. Try again." };
  if (file.size > IMAGE_MAX_BYTES) return { status: "error", message: imageProblem(null, file.size)! };
  const bytes = stripJpegMetadata(new Uint8Array(await file.arrayBuffer()));
  const info = sniffImage(bytes);
  const problem = imageProblem(info, bytes.length);
  if (problem || !info) return { status: "error", message: problem ?? "That isn't an image." };
  const base = supabaseUrl();
  if (!isSupabaseAdminConfigured() || !base) return { status: "error", message: "Images need the database." };

  const admin = createAdminClient();
  let used: number | null;
  try {
    used = await usedImageBytes(admin);
  } catch (error) {
    log.error("Reading the image space failed", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Uploading failed. Try again in a moment." };
  }
  if (used === null) return { status: "error", message: "Image uploads arrive with a database update that isn't applied yet. Try again in a few minutes." };
  const full = budgetProblem(used, bytes.length);
  if (full) return { status: "error", message: full };

  const path = imagePath(randomUUID(), info);
  const { error: uploadError } = await admin.storage
    .from(IMAGE_BUCKET)
    .upload(path, bytes, { contentType: IMAGE_MIME[info.type], cacheControl: "31536000", upsert: false });
  if (uploadError) {
    log.error("Uploading an image failed", { error: uploadError.message });
    return { status: "error", message: "Uploading failed. Try again in a moment." };
  }
  const { error: rowError } = await admin.from("content_images").insert({ path, bytes: bytes.length });
  if (rowError) {
    log.error("Recording an image failed", { error: rowError.message, code: rowError.code });
    await admin.storage.from(IMAGE_BUCKET).remove([path]);
    return { status: "error", message: missingTable(rowError) ? "Image uploads arrive with a database update that isn't applied yet." : "Uploading failed. Try again in a moment." };
  }
  const kind = formData.get("kind");
  await audit(access.user, "content_image.upload", "content_images", null, {
    path,
    bytes: bytes.length,
    width: info.width,
    height: info.height,
    kind: isImageKind(kind) ? kind : null,
  });
  return { status: "saved", url: imageUrl(base, path) };
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

function announcementsChanged(locale: string) {
  updateTag(CACHE_TAGS.announcements);
  revalidatePath(adminPath(locale, "/announcements"));
}

type ExistingAnnouncement = { title: Localized; body: Localized; body_source?: Localized | null; published: boolean };

export async function saveAnnouncement(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  const parsed = parseAnnouncementForm(formData, { supabaseUrl: supabaseUrl() });
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const input = parsed.value;
  const admin = createAdminClient();

  let existing: ExistingAnnouncement | null = null;
  if (id) {
    const { data, error } = await admin.from("announcements").select("*").eq("id", id).maybeSingle();
    if (error) return failed(log, "Reading the announcement", error);
    if (!data) return GONE_ANNOUNCEMENT;
    existing = data as ExistingAnnouncement;
  }

  const row: Record<string, unknown> = {
    title: localizedUpdate(existing?.title, input.title),
    ...bodyColumns(existing, input.bodySource),
    pinned: input.pinned,
    published: input.published,
    expires_at: input.expiresAt,
  };
  // A draft that goes live counts from today, so it shows as new.
  if (input.published && existing && !existing.published) row.published_at = new Date().toISOString();
  if (existing && !("body_source" in existing)) delete row.body_source;

  const write = (values: Record<string, unknown>) =>
    id ? admin.from("announcements").update(values).eq("id", id).select("id").single() : admin.from("announcements").insert(values).select("id").single();
  let result = await write(row);
  if (result.error && missingColumn(result.error) && "body_source" in row) {
    delete row.body_source;
    result = await write(row);
  }
  if (result.error) return failed(log, "Saving the announcement", result.error);

  const savedId = String(result.data.id);
  await audit(access.user, id ? "announcement.edit" : "announcement.add", "announcements", savedId, {
    title: input.title,
    published: input.published,
    pinned: input.pinned,
    expiresAt: input.expiresAt,
  });
  announcementsChanged(locale);
  if (!id) redirect(adminPath(locale, `/announcements/${savedId}?created=${input.published ? "live" : "draft"}`));
  return {
    status: "saved",
    message: input.published ? "Saved. Players see it on Home within seconds; other languages follow within a minute." : "Saved as a draft: players don't see it.",
  };
}

export async function deleteAnnouncement(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, "/announcements?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/announcements"));
  const log = await actionLogger();
  const admin = createAdminClient();
  const { data, error } = await admin.from("announcements").delete().eq("id", id).select("title");
  if (error) {
    log.error("Deleting the announcement failed", { error: error.message, code: error.code });
    redirect(adminPath(locale, "/announcements?error=delete"));
  }
  const title = (data?.[0]?.title as Localized | undefined)?.en ?? null;
  if (data?.length) await audit(access.user, "announcement.delete", "announcements", id, { title });
  announcementsChanged(locale);
  redirect(adminPath(locale, "/announcements?deleted=1"));
}

// ---------------------------------------------------------------------------
// Manual corrections of one language (never English, never re-translated)
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** The content tables whose translations are corrected here, with what each column takes and where its editor is. */
const CONTENT_TRANSLATIONS: Record<string, { columns: Record<string, number>; tag: CacheTag; path: (row: Row) => string }> = {
  announcements: { columns: { title: TITLE_MAX, body: BODY_MAX }, tag: CACHE_TAGS.announcements, path: (row) => `/announcements/${row.id}` },
  rule_topics: { columns: { title: TITLE_MAX }, tag: CACHE_TAGS.rules, path: (row) => `/rules/topics/${row.id}` },
  rules: { columns: { title: TITLE_MAX, body: BODY_MAX }, tag: CACHE_TAGS.rules, path: (row) => `/rules/${row.id}` },
  guides: { columns: { title: TITLE_MAX, summary: SUMMARY_MAX, body: BODY_MAX }, tag: CACHE_TAGS.guides, path: (row) => `/guides/${row.id}` },
  guide_sections: { columns: { body: BODY_MAX }, tag: CACHE_TAGS.guides, path: (row) => `/guides/${row.guide_id}/alliances/${row.id}` },
};

export async function saveContentTranslation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const table = textField(formData, "table");
  const column = textField(formData, "column");
  const lang = textField(formData, "lang");
  const id = uuidField(formData, "id");
  const config = Object.hasOwn(CONTENT_TRANSLATIONS, table) ? CONTENT_TRANSLATIONS[table] : null;
  if (!id || !config || !Object.hasOwn(config.columns, column)) return { status: "error", message: "Unknown field." };
  if (lang === "en" || !isLocaleCode(lang)) return { status: "error", message: "English is edited in English mode." };
  if (!(await getEnabledLocales()).includes(lang)) return { status: "error", message: "That language is not enabled." };
  // Whitespace inside Markdown matters (line breaks): only the ends are trimmed.
  const value = textField(formData, "value").replace(/\r\n?/g, "\n").slice(0, config.columns[column]);

  const admin = createAdminClient();
  const { data: row } = await admin.from(table).select("*").eq("id", id).maybeSingle();
  if (!row) return { status: "error", message: "This text no longer exists." };
  if (pendingColumns(table, row).includes(column)) {
    return { status: "error", message: "The machine translation of this text is still running; try again in a moment." };
  }

  const current = (row[column] ?? {}) as Localized;
  const update: Record<string, unknown> =
    column === "body"
      ? {
          body: withLanguage(current, lang, value ? markdownToHtml(value) : ""),
          ...("body_source" in row ? { body_source: withLanguage((row.body_source ?? {}) as Localized, lang, value) } : {}),
        }
      : { [column]: withLanguage(current, lang, value) };
  // source_hash is deliberately left alone: the English is unchanged, so the pipeline skips this row.
  const { error } = await admin.from(table).update(update).eq("id", id);
  if (error) return failed(log, "Saving the translation", error);

  await audit(access.user, "translation.update", table, id, { column, lang });
  updateTag(config.tag);
  for (const route of routesForTag(config.tag)) revalidatePath(route, "page");
  revalidatePath(adminPath(locale, config.path(row)));
  return { status: "saved", message: "Saved for this language only." };
}

// ---------------------------------------------------------------------------
// Order of rule topics, rules (within their topic) and guides: the ▲ ▼ arrows
// ---------------------------------------------------------------------------

const ORDERED: Record<ContentOrderTable, { action: string; tag: CacheTag; list: string; scope?: string }> = {
  rule_topics: { action: "rule_topic", tag: CACHE_TAGS.rules, list: "/rules" },
  rules: { action: "rule", tag: CACHE_TAGS.rules, list: "/rules", scope: "topic_id" },
  guides: { action: "guide", tag: CACHE_TAGS.guides, list: "/guides" },
};

const MOVE_FAILED = "Moving failed. Reload the page and try again.";

export async function moveContentRow(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  const table = textField(formData, "table");
  const direction = textField(formData, "direction");
  if (!id || !isContentOrderTable(table) || !isMoveDirection(direction)) return { status: "error", message: MOVE_FAILED };
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const config = ORDERED[table];
  const admin = createAdminClient();

  // A rule moves among the rules of its own topic, read from the row rather than the form.
  let query = admin.from(table).select("id, sort_order").order("sort_order").order("created_at");
  if (config.scope) {
    const { data: row, error } = await admin.from(table).select(config.scope).eq("id", id).maybeSingle();
    if (error) return failed(log, `Reordering ${table}`, error, MOVE_FAILED);
    if (!row) return { status: "idle" };
    query = query.eq(config.scope, String((row as unknown as Row)[config.scope]));
  }
  const { data: rows, error } = await query;
  if (error) return failed(log, `Reordering ${table}`, error, MOVE_FAILED);
  const order = moveInList((rows ?? []).map((row) => String(row.id)), id, direction);
  if (!order) return { status: "idle" }; // deleted meanwhile, or already at that end
  const current = new Map((rows ?? []).map((row) => [String(row.id), Number(row.sort_order)]));
  for (const [index, rowId] of order.entries()) {
    if (current.get(rowId) === index) continue;
    const { error: writeError } = await admin.from(table).update({ sort_order: index }).eq("id", rowId);
    if (writeError) return failed(log, `Reordering ${table}`, writeError, MOVE_FAILED);
  }
  await audit(access.user, `${config.action}.move`, table, id, { direction });
  updateTag(config.tag);
  for (const route of routesForTag(config.tag)) revalidatePath(route, "page");
  revalidatePath(adminPath(locale, config.list));
  return { status: "saved" };
}
