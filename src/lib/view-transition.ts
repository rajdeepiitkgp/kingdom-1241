/**
 * Short crossfades via the browser's View Transitions API. Everything falls
 * back to an instant change when the API is missing or the visitor prefers
 * reduced motion. Route navigations inside one language are handled
 * declaratively by React's <ViewTransition> in the route template; language
 * switches (which replace the root layout) use `withNavigationTransition`.
 */

type StartViewTransition = (callback: () => void | Promise<void>) => { ready?: Promise<unknown> } | undefined;
type TransitionDocument = Document & {
  startViewTransition?: StartViewTransition;
  /** The crossfade running now, null without one (browsers that have it). */
  activeViewTransition?: unknown;
  /** React's handle on its own crossfade of a page change, the fallback where the browser has no `activeViewTransition`. */
  __reactViewTransition?: unknown;
};

function startViewTransition(): StartViewTransition | null {
  if (typeof document === "undefined") return null;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  const doc = document as TransitionDocument;
  const start = doc.startViewTransition;
  if (typeof start !== "function") return null;
  // A new crossfade skips the one running, and React reports its skipped page change as an uncaught
  // "Transition was skipped" (a theme or language tap while the new page fades in), so that change happens at once.
  if (doc.activeViewTransition ?? doc.__reactViewTransition) return null;
  return (callback) => {
    const transition = start.call(document, callback);
    // A crossfade cut short by a newer one (a quick tap on a link right after the theme switch) rejects `ready`
    // with "Transition was skipped"; the change itself is done, so it must not reach the console as an error.
    transition?.ready?.catch(() => {});
    return transition;
  };
}

/** Run a synchronous DOM update inside a crossfade. */
export function withViewTransition(update: () => void): void {
  const start = startViewTransition();
  if (!start) {
    update();
    return;
  }
  start(update);
}

let settleNavigation: (() => void) | null = null;

/**
 * Crossfade a navigation that replaces the root layout (language switch).
 * The old frame stays on screen until the new layout reports in through
 * `markNavigationSettled()` (or 1.5 s pass), then the two frames crossfade.
 */
export function withNavigationTransition(navigate: () => void): void {
  const start = startViewTransition();
  if (!start) {
    navigate();
    return;
  }
  start(
    () =>
      new Promise<void>((resolve) => {
        const done = () => {
          settleNavigation = null;
          window.clearTimeout(timer);
          resolve();
        };
        const timer = window.setTimeout(done, 1500);
        settleNavigation = done;
        navigate();
      }),
  );
}

/** Called by the root layout once a new locale has rendered. */
export function markNavigationSettled(): void {
  settleNavigation?.();
}
