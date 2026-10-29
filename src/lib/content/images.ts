// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Images in the content editor (pure, shared by the browser and the server).
 *
 * The free plan's Storage is 1 GB, separate from the 500 MB database, so the
 * editor keeps images small and few: the browser shrinks every image to fit
 * IMAGE_MAX_WIDTH × IMAGE_MAX_HEIGHT (a full phone screenshot keeps its
 * sharpness) and re-encodes it as WebP, or JPEG where the browser can't write
 * WebP, aiming at IMAGE_TARGET_BYTES; re-encoding also drops the photo's
 * metadata (camera GPS). The server strips the small metadata block Safari
 * adds to a JPEG (`stripJpegMetadata`), checks the file's own header against
 * the same limits, so nothing else gets into the bucket, and refuses uploads once
 * all images together reach IMAGE_BUDGET_BYTES. Each text holds a few images
 * at most (IMAGES_PER_TEXT); images no text refers to are deleted by the daily
 * prune after ORPHAN_GRACE_MS. Files are named after their id and size, so a
 * new upload is always a new name and can be cached for a year.
 */

const KB = 1024;
const MB = 1024 * KB;

export const IMAGE_MAX_WIDTH = 1600;
export const IMAGE_MAX_HEIGHT = 2560;
/** What the browser aims at … */
export const IMAGE_TARGET_BYTES = 600 * KB;
/** … and the most the server takes (under the 1 MB a Server Action accepts). */
export const IMAGE_MAX_BYTES = 900 * KB;
/** All content images together: half of the free plan's Storage. */
export const IMAGE_BUDGET_BYTES = 500 * MB;
/** An image no text refers to is deleted after this long (time to finish and save the text). */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export const IMAGE_BUCKET = "images";
const PUBLIC_PREFIX = `/storage/v1/object/public/${IMAGE_BUCKET}/`;

/** Which text an image goes into decides how many it may hold: announcements and rules are read by everyone, guides are long. */
export type ImageKind = "announcement" | "rule" | "guide";
export const IMAGES_PER_TEXT: Record<ImageKind, number> = { announcement: 3, rule: 3, guide: 10 };

export function isImageKind(value: unknown): value is ImageKind {
  return typeof value === "string" && Object.hasOwn(IMAGES_PER_TEXT, value);
}

export type ImageType = "webp" | "jpeg";
export const IMAGE_MIME: Record<ImageType, string> = { webp: "image/webp", jpeg: "image/jpeg" };
const EXTENSION: Record<ImageType, string> = { webp: "webp", jpeg: "jpg" };

/** The size to draw at: the image scaled down (never up) to fit within the box, keeping its proportions. */
export function fitWithin(width: number, height: number, maxWidth = IMAGE_MAX_WIDTH, maxHeight = IMAGE_MAX_HEIGHT): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * The browser's attempts, in order, until one is small enough: lower quality
 * first (it costs little sharpness), then smaller sizes. `scale` applies to
 * the size from `fitWithin`.
 */
export const SHRINK_STEPS: ReadonlyArray<{ scale: number; quality: number }> = [
  { scale: 1, quality: 0.85 },
  { scale: 1, quality: 0.75 },
  { scale: 1, quality: 0.65 },
  { scale: 0.8, quality: 0.7 },
  { scale: 0.64, quality: 0.7 },
  { scale: 0.5, quality: 0.65 },
  { scale: 0.4, quality: 0.6 },
];

export interface ImageInfo {
  type: ImageType;
  width: number;
  height: number;
  /** Carries EXIF or XMP (camera data, location): the editor's output never does. */
  metadata: boolean;
  /** An animated WebP: refused, the editor only writes still images. */
  animated: boolean;
}

/** Reads type and size from a file's header (WebP or JPEG only); null for anything else or a broken file. */
export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return sniffWebp(bytes);
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return sniffJpeg(bytes);
  return null;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000;
const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];

function sniffWebp(bytes: Uint8Array): ImageInfo | null {
  let width = 0;
  let height = 0;
  let metadata = false;
  let animated = false;
  // Chunks: a four-letter id, a little-endian size, the data, padded to an even length.
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = ascii(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const data = offset + 8;
    if (data + size > bytes.length) return null;
    if (id === "VP8X" && size >= 10) {
      const flags = bytes[data];
      if (flags & 0x0c) metadata = true; // EXIF 0x08, XMP 0x04
      if (flags & 0x02) animated = true;
      width = u24le(bytes, data + 4) + 1;
      height = u24le(bytes, data + 7) + 1;
    } else if (id === "VP8 " && size >= 10 && !width) {
      if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) return null;
      width = u16le(bytes, data + 6) & 0x3fff;
      height = u16le(bytes, data + 8) & 0x3fff;
    } else if (id === "VP8L" && size >= 5 && !width) {
      if (bytes[data] !== 0x2f) return null;
      const bits = u32le(bytes, data + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    } else if (id === "EXIF" || id === "XMP ") {
      metadata = true;
    } else if (id === "ANIM" || id === "ANMF") {
      animated = true;
    }
    offset = data + size + (size % 2);
  }
  return width && height ? { type: "webp", width, height, metadata, animated } : null;
}

/** Start-of-frame markers (baseline, progressive, …), which carry the size; not DHT (C4), JPG (C8) or DAC (CC). */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function sniffJpeg(bytes: Uint8Array): ImageInfo | null {
  let metadata = false;
  for (let offset = 2; offset + 4 <= bytes.length; ) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // markers without a length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image or start of scan before any frame header
    const length = u16be(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    // APP1 holds EXIF and XMP, APP13 the Photoshop/IPTC block.
    if (marker === 0xe1 || marker === 0xed) metadata = true;
    if (SOF.has(marker)) {
      if (length < 7) return null;
      const height = u16be(bytes, offset + 5);
      const width = u16be(bytes, offset + 7);
      return width && height ? { type: "jpeg", width, height, metadata, animated: false } : null;
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * A JPEG without its APP1 (EXIF, XMP) and APP13 (Photoshop/IPTC) segments.
 * Safari writes a small EXIF block (colour space, pixel size) into every JPEG
 * a canvas encodes; stripping these instead of refusing them means no camera
 * data or location is ever stored, whichever browser made the file. Returns
 * the bytes unchanged when they aren't a well-formed JPEG header.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  for (let offset = 2; offset + 2 <= bytes.length; ) {
    if (bytes[offset] !== 0xff) return bytes;
    const marker = bytes[offset + 1];
    // From the start of scan on, everything is image data.
    if (marker === 0xda) {
      kept.push(bytes.subarray(offset));
      const out = new Uint8Array(kept.reduce((n, part) => n + part.length, 0));
      let at = 0;
      for (const part of kept) {
        out.set(part, at);
        at += part.length;
      }
      return out;
    }
    if (offset + 4 > bytes.length) return bytes;
    const length = u16be(bytes, offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return bytes;
    if (marker !== 0xe1 && marker !== 0xed) kept.push(bytes.subarray(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return bytes;
}

/** Why the server refuses an uploaded file, or null when it is one the editor made. */
export function imageProblem(info: ImageInfo | null, bytes: number): string | null {
  if (bytes <= 0) return "The file is empty.";
  if (bytes > IMAGE_MAX_BYTES) return `The image is over ${IMAGE_MAX_BYTES / KB} KB. Add it with the image button, which shrinks it first.`;
  if (!info) return "Only images shrunk by the editor (WebP or JPEG) can be uploaded. Add it with the image button.";
  if (info.animated) return "Animated images can't be uploaded.";
  if (info.metadata) return "The image still carries camera data. Add it with the image button, which removes it.";
  if (info.width > IMAGE_MAX_WIDTH || info.height > IMAGE_MAX_HEIGHT) {
    return `The image is ${info.width} × ${info.height} pixels; at most ${IMAGE_MAX_WIDTH} × ${IMAGE_MAX_HEIGHT} fits. Add it with the image button, which shrinks it first.`;
  }
  return null;
}

/** Why the budget refuses a new image of `bytes`, or null while it fits. */
export function budgetProblem(usedBytes: number, bytes: number, budget = IMAGE_BUDGET_BYTES): string | null {
  return usedBytes + bytes > budget
    ? `The site's image space is full (${Math.round(budget / MB)} MB). Images of deleted texts are cleared once a day; to make room now, remove images from old announcements.`
    : null;
}

/** Where an image is stored: its id and pixel size are in the name, so the page can reserve its space before it loads. */
export function imagePath(id: string, info: Pick<ImageInfo, "type" | "width" | "height">): string {
  return `content/${id}-${info.width}x${info.height}.${EXTENSION[info.type]}`;
}

const PATH_PATTERN = "content/[0-9a-f-]{36}-(\\d{1,4})x(\\d{1,4})\\.(?:webp|jpg)";
const PATH_ONLY = new RegExp(`^${PATH_PATTERN}$`);

/** The pixel size in a stored image's name, or null for any other path. */
export function imageSizeFromPath(path: string): { width: number; height: number } | null {
  const match = PATH_ONLY.exec(path);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

/** The public address of a stored image. */
export function imageUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}${PUBLIC_PREFIX}${path}`;
}

/** The stored path of one of our images from its address, or null for any other address. */
export function imagePathFromUrl(url: string, supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  const prefix = `${supabaseUrl.replace(/\/+$/, "")}${PUBLIC_PREFIX}`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return PATH_ONLY.test(path) ? path : null;
}

/** Every stored image a text refers to (Markdown or HTML, any language). */
export function referencedImagePaths(texts: Iterable<string>): Set<string> {
  const pattern = new RegExp(`${PUBLIC_PREFIX.replace(/\//g, "\\/")}(${PATH_PATTERN})`, "g");
  const paths = new Set<string>();
  for (const text of texts) for (const match of text.matchAll(pattern)) paths.add(match[1]);
  return paths;
}

const MARKDOWN_IMAGE = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const HTML_IMAGE = /<img\b[^>]*?\bsrc\s*=\s*["']?([^"'\s>]+)/gi;

/** The address of every image in a Markdown text (its own syntax and any HTML image in it). */
export function imageUrls(markdown: string): string[] {
  return [...markdown.matchAll(MARKDOWN_IMAGE), ...markdown.matchAll(HTML_IMAGE)].map((match) => match[1]);
}

/** Images from anywhere but our own storage: the page wouldn't show them, so the form refuses them. */
export function foreignImages(markdown: string, supabaseUrl: string | undefined): string[] {
  return imageUrls(markdown).filter((url) => !imagePathFromUrl(url, supabaseUrl));
}
