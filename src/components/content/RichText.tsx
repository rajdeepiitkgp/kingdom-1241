import { sanitizeRichText } from "@/lib/html";
import { SanitizedHtml } from "./SanitizedHtml";

/**
 * Renders stored rich text (HTML) in a Server Component. Content is sanitised
 * again at render time as a belt-and-braces measure — never trust what is in
 * the database. Client Components can't use this (it would ship the sanitiser
 * to the browser): prepare the HTML on the server with `prepareRichText` and
 * hand the result to `SanitizedHtml` instead, as the rules page does.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return <SanitizedHtml html={prepareRichText(html)} className={className} />;
}

/** Sanitised HTML with the table wrappers: what RichText renders, for components that post-process it. */
export function prepareRichText(html: string): string {
  return wrapTables(sanitizeRichText(html));
}

function wrapTables(html: string): string {
  return html.replace(/<table/g, '<div class="table-wrap"><table').replace(/<\/table>/g, "</table></div>");
}
