/**
 * Text size preference. Scales the root font size in a few steps so every
 * rem-based size on the site follows (Tailwind classes are rem). "m" is the
 * browser's own default size, so players who already enlarged text in their
 * phone settings start from that and can go further.
 */
export const TEXT_SCALES = ["s", "m", "l", "xl"] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export const DEFAULT_TEXT_SCALE: TextScale = "m";

/** Root font-size per step (percent of the browser default). */
export const TEXT_SCALE_PERCENT: Record<TextScale, number> = { s: 87.5, m: 100, l: 112.5, xl: 125 };

/** localStorage key and the <html data-text-scale> attribute name. */
export const TEXT_SCALE_STORAGE_KEY = "kd1241_text_scale";
export const TEXT_SCALE_ATTRIBUTE = "data-text-scale";

export function isTextScale(value: unknown): value is TextScale {
  return typeof value === "string" && (TEXT_SCALES as readonly string[]).includes(value);
}

export function parseTextScale(value: unknown): TextScale {
  return isTextScale(value) ? value : DEFAULT_TEXT_SCALE;
}

export function nextTextScale(current: TextScale, direction: 1 | -1): TextScale {
  const index = TEXT_SCALES.indexOf(current);
  const next = Math.min(TEXT_SCALES.length - 1, Math.max(0, index + direction));
  return TEXT_SCALES[next];
}

export function canChangeTextScale(current: TextScale, direction: 1 | -1): boolean {
  return nextTextScale(current, direction) !== current;
}

/**
 * Inline script for <head>: applies the saved size before the first paint so
 * the page never flashes at the default size. Kept tiny and dependency-free.
 */
export const TEXT_SCALE_INIT_SCRIPT = `try{var s=localStorage.getItem(${JSON.stringify(TEXT_SCALE_STORAGE_KEY)});if(s&&s!==${JSON.stringify(DEFAULT_TEXT_SCALE)}&&${JSON.stringify(TEXT_SCALES)}.indexOf(s)>-1)document.documentElement.setAttribute(${JSON.stringify(TEXT_SCALE_ATTRIBUTE)},s)}catch(e){}`;

/** Fired on `window` whenever the text scale is applied, so controls can re-read it. */
export const TEXT_SCALE_CHANGE_EVENT = "kd1241:text-scale";

/** Read the saved preference (browser only). */
export function readStoredTextScale(): TextScale {
  try {
    return parseTextScale(window.localStorage.getItem(TEXT_SCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_TEXT_SCALE;
  }
}

/** Put the scale on <html> (and optionally in storage) and notify listeners. Browser only. */
export function applyTextScale(scale: TextScale, persist = true) {
  if (scale === DEFAULT_TEXT_SCALE) document.documentElement.removeAttribute(TEXT_SCALE_ATTRIBUTE);
  else document.documentElement.setAttribute(TEXT_SCALE_ATTRIBUTE, scale);
  if (persist) {
    try {
      if (scale === DEFAULT_TEXT_SCALE) window.localStorage.removeItem(TEXT_SCALE_STORAGE_KEY);
      else window.localStorage.setItem(TEXT_SCALE_STORAGE_KEY, scale);
    } catch {
      // Storage blocked: the size still applies for this page view.
    }
  }
  window.dispatchEvent(new Event(TEXT_SCALE_CHANGE_EVENT));
}
