import { foreignImages, type ImageKind, IMAGES_PER_TEXT, imageUrls } from "@/lib/content/images";
import { htmlToMarkdown } from "@/lib/content/html-to-markdown";
import type { Localized } from "@/lib/i18n/localized";
import { boolField, type FieldErrors, type FormResult, slugify, textField, utcDateTimeField, uuidField } from "./forms";

/**
 * Parsing of the content editor's forms (pure, unit-tested): announcements,
 * rule topics and rules, guides and their alliance sections. The texts are
 * Markdown; the actions turn them into HTML.
 */

export const TITLE_MAX = 120;
export const BODY_MAX = 20_000;
export const SUMMARY_MAX = 300;
/** The line under every English Markdown field. */
export const MARKDOWN_HINT =
  "Use the buttons, or Markdown: **bold**, *italics*, ## heading, - list, > a gold box, > [!DANGER] a red one. Text copied from Discord keeps its formatting. Preview shows it as players will see it. Add images with the picture button, or paste or drop them into the text.";
/** An icon is one emoji; a few code points leave room for skin tones, flags and joined emoji. */
export const ICON_MAX = 8;

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

/** The title field: required, one line. */
function titleField(fd: FormData, errors: FieldErrors, missing: string): string {
  const title = textField(fd, "title");
  if (!title) errors.title = missing;
  else if (title.length > TITLE_MAX) errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  return title;
}

/** The Markdown text field `bodySource`: required, within the length and the image rules of its kind. */
function markdownField(fd: FormData, kind: ImageKind, supabaseUrl: string | undefined, errors: FieldErrors, missing: string): string {
  const bodySource = textField(fd, "bodySource").replace(/\r\n?/g, "\n");
  if (!bodySource) errors.bodySource = missing;
  else if (bodySource.length > BODY_MAX) errors.bodySource = `Keep the text under ${BODY_MAX.toLocaleString("en-US")} characters.`;
  else {
    const problem = bodyImageProblem(bodySource, kind, supabaseUrl);
    if (problem) errors.bodySource = problem;
  }
  return bodySource;
}

/** One emoji as the icon; empty means the default. */
export function iconField(fd: FormData, fallback: string, errors: FieldErrors): string {
  const icon = textField(fd, "icon");
  if (!icon) return fallback;
  if ([...icon].length > ICON_MAX || /[\s<>]/.test(icon)) errors.icon = "One emoji, such as 🐻.";
  return icon;
}

/** The page address (`/guides/<slug>`, `/rules#<slug>`): typed, else made from the title. */
function slugField(fd: FormData, title: string, errors: FieldErrors): string {
  const slug = slugify(textField(fd, "slug") || title);
  if (!slug && !errors.title) errors.slug = "The address needs at least one letter or digit (a-z, 0-9).";
  return slug;
}

export function parseAnnouncementForm(fd: FormData, options: { supabaseUrl: string | undefined }): FormResult<AnnouncementInput> {
  const errors: FieldErrors = {};
  const title = titleField(fd, errors, "Give the announcement a title.");
  const bodySource = markdownField(fd, "announcement", options.supabaseUrl, errors, "Write the announcement.");
  const expiresAt = utcDateTimeField(fd, "expiresAt");
  if (expiresAt === undefined) errors.expiresAt = "Enter a date and time, or leave it empty.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, bodySource, pinned: boolField(fd, "pinned"), published: boolField(fd, "published"), expiresAt: expiresAt ?? null } };
}

export interface RuleTopicInput {
  title: string;
  icon: string;
  slug: string;
  published: boolean;
}

export function parseRuleTopicForm(fd: FormData): FormResult<RuleTopicInput> {
  const errors: FieldErrors = {};
  const title = titleField(fd, errors, "Give the topic a name.");
  const icon = iconField(fd, "📜", errors);
  const slug = slugField(fd, title, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, icon, slug, published: boolField(fd, "published") } };
}

export interface RuleInput {
  topicId: string;
  title: string;
  bodySource: string;
  published: boolean;
}

export function parseRuleForm(fd: FormData, options: { supabaseUrl: string | undefined }): FormResult<RuleInput> {
  const errors: FieldErrors = {};
  const topicId = uuidField(fd, "topicId");
  if (!topicId) errors.topicId = "Pick the topic this rule belongs to.";
  const title = titleField(fd, errors, "Give the rule a title.");
  const bodySource = markdownField(fd, "rule", options.supabaseUrl, errors, "Explain the rule.");
  if (Object.keys(errors).length > 0 || !topicId) return { ok: false, errors };
  return { ok: true, value: { topicId, title, bodySource, published: boolField(fd, "published") } };
}

export interface GuideInput {
  title: string;
  summary: string;
  icon: string;
  slug: string;
  bodySource: string;
  published: boolean;
}

export function parseGuideForm(fd: FormData, options: { supabaseUrl: string | undefined }): FormResult<GuideInput> {
  const errors: FieldErrors = {};
  const title = titleField(fd, errors, "Give the guide a title.");
  const summary = textField(fd, "summary").replace(/\s+/g, " ");
  if (!summary) errors.summary = "Write one or two sentences for the list of guides.";
  else if (summary.length > SUMMARY_MAX) errors.summary = `Keep the summary under ${SUMMARY_MAX} characters.`;
  const icon = iconField(fd, "📖", errors);
  const slug = slugField(fd, title, errors);
  const bodySource = markdownField(fd, "guide", options.supabaseUrl, errors, "Write the guide.");
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { title, summary, icon, slug, bodySource, published: boolField(fd, "published") } };
}

export interface GuideSectionInput {
  /** Only on a new section: an existing one keeps its alliance. */
  allianceTag: string | null;
  bodySource: string;
  published: boolean;
}

/**
 * One alliance's section of a guide. A new section names its alliance, which
 * must be on the alliance list (`allianceTags`, exact case: [NAM] and [Nam] are
 * two alliances) and not have a section in this guide yet (`taken`).
 */
export function parseGuideSectionForm(
  fd: FormData,
  options: { supabaseUrl: string | undefined; isNew: boolean; allianceTags: readonly string[]; taken: readonly string[] },
): FormResult<GuideSectionInput> {
  const errors: FieldErrors = {};
  let allianceTag: string | null = null;
  if (options.isNew) {
    allianceTag = textField(fd, "allianceTag");
    if (!allianceTag) errors.allianceTag = "Pick the alliance.";
    else if (!options.allianceTags.includes(allianceTag)) errors.allianceTag = "That alliance isn't on the alliance list.";
    else if (options.taken.includes(allianceTag)) errors.allianceTag = `[${allianceTag}] already has a section in this guide: edit that one.`;
  }
  const bodySource = markdownField(fd, "guide", options.supabaseUrl, errors, "Write how this alliance plays it.");
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { allianceTag, bodySource, published: boolField(fd, "published") } };
}

/** The lists whose order the ▲ ▼ arrows change (rules within their topic). */
export const CONTENT_ORDER_TABLES = ["rule_topics", "rules", "guides"] as const;
export type ContentOrderTable = (typeof CONTENT_ORDER_TABLES)[number];

export function isContentOrderTable(value: string): value is ContentOrderTable {
  return (CONTENT_ORDER_TABLES as readonly string[]).includes(value);
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
