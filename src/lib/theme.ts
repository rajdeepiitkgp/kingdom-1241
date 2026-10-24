/**
 * Light / dark theme without a library. The choice is the `dark` class on
 * <html> (plus `color-scheme`), saved in localStorage under the key next-themes
 * used before, so existing visitors keep their setting. An inline script
 * inserted into the server HTML (see UiInit) applies it before the first paint.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME: Theme = "light";
/** Fired on `window` whenever the theme is applied, so controls can re-read it. */
export const THEME_CHANGE_EVENT = "kd1241:theme";

export function parseTheme(value: unknown): Theme {
  return value === "dark" ? "dark" : DEFAULT_THEME;
}

/** Read the saved preference (browser only). */
export function readStoredTheme(): Theme {
  try {
    return parseTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

/** Put the theme on <html> (and optionally in storage) and notify listeners. Browser only. */
export function applyTheme(theme: Theme, persist = true) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage blocked: the theme still applies for this page view.
    }
  }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Inline script for the server HTML: applies the saved theme before the first paint. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark"?"dark":"light";var r=document.documentElement;r.classList.add(t);r.style.colorScheme=t}catch(e){}`;
