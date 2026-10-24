import clsx from "clsx";

/**
 * Renders HTML that has already been through `prepareRichText` on the server
 * (see RichText.tsx). This is the only piece a Client Component may use for
 * rich text: it imports no sanitiser, so the HTML cleaner and the Markdown
 * parser stay out of the browser bundle (tests/architecture guards that).
 * Never pass it raw database or user content.
 */
export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={clsx("prose-game", className)}
      dir="auto"
      // Sanitised on the server; tables got a scroll wrapper there too.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
