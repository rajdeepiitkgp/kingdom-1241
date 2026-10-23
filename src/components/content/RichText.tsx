import clsx from "clsx";
import { sanitizeRichText } from "@/lib/html";

/**
 * Renders stored rich text (HTML). Content is sanitised again at render time
 * as a belt-and-braces measure — never trust what is in the database.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={clsx("prose-game", className)}
      dir="auto"
      // Sanitised above; tables get a scroll wrapper on small screens.
      dangerouslySetInnerHTML={{ __html: wrapTables(sanitizeRichText(html)) }}
    />
  );
}

function wrapTables(html: string): string {
  return html.replace(/<table/g, '<div class="table-wrap"><table').replace(/<\/table>/g, "</table></div>");
}
