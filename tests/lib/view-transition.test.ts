import { afterEach, describe, expect, it, vi } from "vitest";
import { markNavigationSettled, withNavigationTransition, withViewTransition } from "@/lib/view-transition";

afterEach(() => vi.unstubAllGlobals());

/** A browser with the View Transitions API; `running` is what the page has going when the change comes. */
function browser({ running = {}, reducedMotion = false, api = true }: { running?: { active?: unknown; react?: unknown }; reducedMotion?: boolean; api?: boolean } = {}) {
  const started: Array<() => void | Promise<void>> = [];
  vi.stubGlobal("window", { matchMedia: () => ({ matches: reducedMotion }), setTimeout, clearTimeout });
  vi.stubGlobal("document", {
    activeViewTransition: running.active,
    __reactViewTransition: running.react,
    startViewTransition: api
      ? (callback: () => void | Promise<void>) => {
          started.push(callback);
          void callback();
          return { ready: Promise.reject(new Error("Transition was skipped")) };
        }
      : undefined,
  });
  return started;
}

describe("withViewTransition", () => {
  it("crossfades the change when nothing else is fading", () => {
    const started = browser({ running: { active: null, react: null } });
    const update = vi.fn();
    withViewTransition(update);
    expect(started).toHaveLength(1);
    expect(update).toHaveBeenCalledOnce();
  });

  it("changes at once while a crossfade runs, so the running one isn't skipped", () => {
    for (const running of [{ active: {} }, { react: {} }, { active: null, react: {} }]) {
      const started = browser({ running });
      const update = vi.fn();
      withViewTransition(update);
      expect(started, JSON.stringify(running)).toHaveLength(0);
      expect(update).toHaveBeenCalledOnce();
    }
  });

  it("changes at once for reduced motion and where the browser has no crossfade", () => {
    for (const options of [{ reducedMotion: true }, { api: false }]) {
      const started = browser(options);
      const update = vi.fn();
      withViewTransition(update);
      expect(started).toHaveLength(0);
      expect(update).toHaveBeenCalledOnce();
    }
  });
});

describe("withNavigationTransition", () => {
  it("holds the old frame until the new language reports in", () => {
    const started = browser();
    const navigate = vi.fn();
    withNavigationTransition(navigate);
    expect(started).toHaveLength(1);
    expect(navigate).toHaveBeenCalledOnce();
    markNavigationSettled();
  });

  it("navigates at once while a page change is still fading in", () => {
    const started = browser({ running: { react: {} } });
    const navigate = vi.fn();
    withNavigationTransition(navigate);
    expect(started).toHaveLength(0);
    expect(navigate).toHaveBeenCalledOnce();
  });
});
