import sanitizeHtml from "sanitize-html";
import { marked } from "marked";

/**
 * Rich-text content (announcements, rules, guides) is stored as HTML so the
 * phase-2 editor can save directly. Everything is sanitised before rendering.
 */

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
    allowedSchemes: ["http", "https", "mailto"],
    // Images over https only: no plain-http hosts (mixed content) and no inline data: blobs.
    allowedSchemesByTag: { img: ["https"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
          ...(attribs.href?.startsWith("http") ? { target: "_blank" } : {}),
        },
      }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}

/** Convert Markdown (used in seed files for readability) to sanitised HTML. */
export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
  return sanitizeRichText(html);
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
