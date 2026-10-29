// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Keeps images away from the model (pure). Before an HTML field is sent for
 * translation every <img> becomes a short placeholder ({{img:0}}, kept as is
 * like every {{…}} placeholder), and afterwards the original tag goes back in
 * its place, so the long image address can never be mistyped and fewer
 * tokens are sent. An answer is only taken when every image comes back once,
 * in the same order and in the same top-level block (paragraph, list, table…)
 * as in English; otherwise `restoreImages` returns null and the pipeline asks
 * again, then leaves that language on the English text until the next run, so
 * an image never shows up in another place. The description (alt) stays English.
 */

const IMAGE = /<img\b[^>]*>/gi;
const PLACEHOLDER = /\{\{\s*img:(\d+)\s*\}\}/g;
const VOID = new Set(["br", "hr", "img", "wbr"]);

export interface Shielded {
  /** The HTML with placeholders, as sent to the model. */
  text: string;
  /** The original image tags, by placeholder number. */
  images: string[];
}

export function shieldImages(html: string): Shielded {
  const images: string[] = [];
  const text = html.replace(IMAGE, (tag) => `{{img:${images.push(tag) - 1}}}`);
  return { text, images };
}

/**
 * Where each placeholder sits, in order: its number and the top-level block
 * it is in (a placeholder between blocks gets the half step after the block
 * before it). Two texts with the same list have their images in the same places.
 */
export function imagePlaces(html: string): string[] {
  const places: string[] = [];
  let depth = 0;
  let block = -1;
  for (const match of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>|\{\{\s*img:(\d+)\s*\}\}/g)) {
    if (match[3] !== undefined) {
      places.push(`${match[3]}@${depth > 0 ? block : block + 0.5}`);
      continue;
    }
    if (match[1]) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0) block += 1;
    if (!VOID.has(match[2].toLowerCase()) && !match[0].endsWith("/>")) depth += 1;
  }
  return places;
}

/** The translation with its images back in place, or null when the model lost, repeated or moved one. */
export function restoreImages(translated: string, shielded: Shielded): string | null {
  const expected = imagePlaces(shielded.text);
  const found = imagePlaces(translated);
  if (found.length !== expected.length || found.some((place, i) => place !== expected[i])) return null;
  if (shielded.images.length === 0) return translated;
  return translated.replace(PLACEHOLDER, (_, index: string) => shielded.images[Number(index)]);
}
