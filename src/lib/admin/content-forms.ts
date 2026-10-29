import { foreignImages, type ImageKind, IMAGES_PER_TEXT, imageUrls } from "@/lib/content/images";
import { htmlToMarkdown } from "@/lib/content/html-to-markdown";
import type { Localized } from "@/lib/i18n/localized";
import { boolField, type FieldErrors, type FormResult, textField, utcDateTimeField } from "./forms";

/**
 * Parsing of the content editor's forms (pure, unit-tested): announcements now,
 * rules and guides next. The text is Markdown; the action turns it into HTML.
 */

export const TITLE_MAX = 120;
export const BODY_MAX = 20_000;

const WHAT: Record<ImageKind, string> = { announcement: "an announcement", rule: "a rule", guide: "a guide" };

/** What is wrong with a text's images, or null: too many for its kind, or from another site. */
export function bodyImageProblem(markdown: string, kind: ImageKind, supabaseUrl: string | undefined): string | null {
  const foreign = foreignImages(markdown, supabaseUrl);
  if (foreign.length > 0) return "Images from other sites aren't shown on the page. Add them with the image button instead (it uploads a small copy).";
  const count = imageUrls(markdown).length;
  const max = IMAGES_PER_TEXT[kind];
  return count > max ? `At most ${max} images in ${WHAT[kind]} (this text has ${count}).` : null;
}

/**
 * The battle pages are locked, the image store isn't: anyone with an image's
 * address could open it, so texts behind a password take no images.
 */
export function lockedPageImageProblem(markdown: string): string | null {
  return imageUrls(markdown).length > 0 ? "Images can't go on the password-locked pages: anyone with an image's link could open it. Describe it in words instead." : null;
}

export interface AnnouncementInput {
  title: string;
  bodySource: string;
  pinned: boolean;
  published: boolean;
  expiresAt: string | null;
}

export function parseAnnouncementForm(fd: FormData, options: { supabaseUrl: string | undefined }): FormResult<AnnouncementInput> {
  const errors: FieldErrors = {};
  const title = textField(fd, "title");
  if (!title) errors.title = "Give the announcement a title.";
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  const bodySource = textField(fd, "bodySource").replace(/\r\n?/g, "\n");
  if (!bodySource) errors.bodySource = "Write the announcement.";
  else if (bodySource.length > BODY_MAX) errors.bodySource = `Keep the text under ${BODY_MAX.toLocaleString("en-US")} characters.`;
  else {
    const problem = bodyImageProblem(bodySource, "announcement", options.supabaseUrl);
    if (problem) errors.bodySource = problem;
  }
  const expiresAt = utcDateTimeField(fd, "expiresAt");
  if (expiresAt === undefined) errors.expiresAt = "Enter a date and time, or leave it empty.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, bodySource, pinned: boolField(fd, "pinned"), published: boolField(fd, "published"), expiresAt: expiresAt ?? null } };
}

/** The Markdown the editor opens for one language: the stored source, else the stored HTML turned back into Markdown. */
export function bodySourceFor(row: { body: Localized | null; bodySource: Localized | null }, lang: string): string {
  const stored = row.bodySource?.[lang];
  if (typeof stored === "string" && stored.trim()) return stored;
  const html = row.body?.[lang];
  return typeof html === "string" ? htmlToMarkdown(html) : "";
}

/** True when the announcement is live on Home right now. */
export function announcementLive(row: { published: boolean; expiresAt: string | null }, now: number): boolean {
  return row.published && (!row.expiresAt || Date.parse(row.expiresAt) > now);
}
