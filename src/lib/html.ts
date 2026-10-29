import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import { imagePathFromUrl, imageSizeFromPath } from "@/lib/content/images";
import { supabaseUrl } from "@/lib/supabase/env";

/**
 * Rich-text content (announcements, rules, guides, the battle-plan intros) is
 * stored as HTML, written from Markdown by the editor. Everything is sanitised
 * on write and again before rendering.
 */

/**
 * Images come from our own storage (uploaded through the editor) or the site
 * itself, never from another host: a hotlinked image tells a stranger who reads
 * the page, and Discord's attachment links expire after a day.
 */
function allowedImage(src: string | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  return imagePathFromUrl(src, supabaseUrl()) !== null;
}

const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h2", "h3", "h4",
  "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup", "code", "pre", "kbd",
  "blockquote",
  "ul", "ol", "li",
  "a",
  "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "span", "div",
];

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan", "align"],
      td: ["colspan", "rowspan", "align"],
      "*": ["dir", "lang"],
    },
    // The one class a text may carry: the red danger box (`> [!DANGER]`, see markDangerBoxes).
    allowedClasses: { blockquote: ["danger"] },
    allowedSchemes: ["http", "https", "mailto"],
    // Images over https only: no plain-http hosts (mixed content) and no inline data: blobs.
    allowedSchemesByTag: { img: ["https"] },
    exclusiveFilter: (frame) => frame.tag === "img" && !allowedImage(frame.attribs.src),
    transformTags: {
      // The page title is the only h1; a "# Heading" pasted from Discord becomes a section heading.
      h1: "h2",
      h5: "h4",
      h6: "h4",
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          ...(attribs.href?.startsWith("http") ? { target: "_blank" } : {}),
        },
      }),
      // Our images carry their size in the name: the page reserves their space before they load.
      img: (tagName, attribs) => {
        const path = attribs.src ? imagePathFromUrl(attribs.src, supabaseUrl()) : null;
        const size = path ? imageSizeFromPath(path) : null;
        return { tagName, attribs: { ...attribs, ...(size ? { width: String(size.width), height: String(size.height) } : {}), loading: "lazy" } };
      },
    },
  });
}

/** The tallest an image shows inside a text (the full size opens on a tap); the same as `.prose-game img` in globals.css. */
const IMAGE_MAX_HEIGHT_REM = 28;

/**
 * Wraps every image of sanitised HTML that isn't inside a link in one to its
 * full size (screenshots are often tall), and gives images of a known size the
 * width they will show at, so a tall one isn't stretched by the height cap.
 */
export function linkImages(html: string): string {
  let linkDepth = 0;
  return html.replace(/<(\/?)(a|img)\b([^>]*)>/gi, (tag, closing: string, name: string, rest: string) => {
    if (name.toLowerCase() === "a") {
      linkDepth = Math.max(0, linkDepth + (closing ? -1 : 1));
      return tag;
    }
    const width = Number(/\bwidth="(\d+)"/.exec(rest)?.[1]);
    const height = Number(/\bheight="(\d+)"/.exec(rest)?.[1]);
    const sized = width && height ? tag.replace(/<img\b/i, `<img style="width:min(100%,${width}px,${((IMAGE_MAX_HEIGHT_REM * width) / height).toFixed(3)}rem)"`) : tag;
    const src = /\bsrc="([^"]+)"/.exec(rest)?.[1];
    if (linkDepth > 0 || !src) return sized;
    return `<a class="image-link" href="${src}" target="_blank" rel="noopener noreferrer">${sized}</a>`;
  });
}

/** Convert Markdown (used in seed files for readability) to sanitised HTML. */
export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
  return sanitizeRichText(markDangerBoxes(html));
}

/**
 * GitHub's alert marker at the start of a quote, `[!DANGER]` (WARNING and
 * CAUTION too, as pasted from GitHub or Obsidian), on its own line or before
 * the text: the marker goes and the quote becomes the red box.
 */
const DANGER_MARK = /<blockquote>(\s*)<p>[ \t]*\[!(?:danger|warning|caution)\][ \t]*(?:<br\s*\/?>)?\s*(<\/p>\s*)?/gi;

/** Quotes that open with the danger marker → `<blockquote class="danger">` (the gold box stays a plain quote). */
export function markDangerBoxes(html: string): string {
  return html.replace(DANGER_MARK, (_match, space: string, closed?: string) => `<blockquote class="danger">${space}${closed ? "" : "<p>"}`);
}

/** Rough plain-text excerpt of an HTML string, for cards and previews. */
export function htmlToExcerpt(html: string, maxLength = 160): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
