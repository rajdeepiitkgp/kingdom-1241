import { ViewTransition, type ReactNode } from "react";

/**
 * Next.js mounts a fresh template instance on every navigation between routes
 * under [locale]. That makes a page change an exit/enter pair for React's
 * <ViewTransition>: the old page fades out where it was, the new one fades in
 * at the top (200 ms, see globals.css). A boundary in the layout would stay
 * mounted and count as an in-place update instead, and the browser would then
 * slide the content from its old scrolled position to the new one, which
 * reads as a fast scroll. Reduced motion turns the fade off in globals.css.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <ViewTransition default="page">{children}</ViewTransition>;
}
