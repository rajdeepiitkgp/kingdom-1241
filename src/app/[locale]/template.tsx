import { ViewTransition, type ReactNode } from "react";

/**
 * Next.js mounts a fresh template instance on every navigation between routes
 * under [locale]. That makes a page change an exit/enter pair for React's
 * <ViewTransition>: the old page fades out where it was, the new one fades in
 * at the top (200 ms, see globals.css). A boundary in the layout would stay
 * mounted and count as an in-place update instead, and the browser would then
 * slide the content from its old scrolled position to the new one, which
 * reads as a fast scroll. Reduced motion turns the fade off in globals.css.
 *
 * `update="none"`: an in-place change inside the page never animates. Without
 * it, a Suspense boundary that streams in on a first load (the KvK gates, the
 * prep board, a Rally Sync room) is revealed by React's streaming runtime
 * inside a view transition, and a browser drops every tap while one runs:
 * the "?" tapped in the first half second after the prep page appeared did
 * nothing on the iPhone job, twice in Nov 2026. Route changes still crossfade,
 * since they are an exit and an enter.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default="page" update="none">
      {children}
    </ViewTransition>
  );
}
