/**
 * The content images in the weekly backup (scripts/backup.ts): the files of
 * the Storage bucket, packed into one archive that is encrypted like the table
 * dump and kept next to it in the same artifact. Pure; the script lists,
 * downloads and uploads.
 *
 * Layout: 4-byte big-endian manifest length | manifest JSON (UTF-8) | the
 * files' bytes in manifest order. The encryption (AES-256-GCM) authenticates
 * the whole archive, so a damaged or altered file is refused before anything
 * is unpacked; the paths are still checked against the pattern the bucket
 * allows, so a restore can only ever write content images.
 */
import { IMAGE_MIME } from "@/lib/content/images";
import { formatBytes } from "@/lib/usage/health";

export const IMAGE_ARCHIVE_FORMAT = "kingdom-1241-images";
export const IMAGE_ARCHIVE_VERSION = 1;

/** What one image is named: `content/<uuid>-<w>x<h>.webp|jpg`, the bucket's own rule (migration 0020). */
export const IMAGE_PATH = /^content\/[0-9a-f-]{36}-\d{1,4}x\d{1,4}\.(webp|jpg)$/;

export interface ImageFile {
  path: string;
  data: Buffer;
}

export interface ArchivedImage {
  path: string;
  bytes: number;
}

export interface ImageManifest {
  format: typeof IMAGE_ARCHIVE_FORMAT;
  version: typeof IMAGE_ARCHIVE_VERSION;
  /** When the files were read (ISO 8601, UTC). */
  createdAt: string;
  /** Host of the Supabase project they came from. */
  source: string;
  files: ArchivedImage[];
}

export interface ImageArchive {
  manifest: ImageManifest;
  files: ImageFile[];
}

export function isImagePath(path: string): boolean {
  return IMAGE_PATH.test(path);
}

/** The MIME type a restored file is uploaded with, from its extension. */
export function imageContentType(path: string): string {
  return path.endsWith(".jpg") ? IMAGE_MIME.jpeg : IMAGE_MIME.webp;
}

export function packImages(files: readonly ImageFile[], source: string, now: Date): Buffer {
  const manifest: ImageManifest = {
    format: IMAGE_ARCHIVE_FORMAT,
    version: IMAGE_ARCHIVE_VERSION,
    createdAt: now.toISOString(),
    source,
    files: files.map((file) => ({ path: file.path, bytes: file.data.length })),
  };
  parseImageManifest(manifest);
  const header = Buffer.from(JSON.stringify(manifest), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length, 0);
  return Buffer.concat([length, header, ...files.map((file) => file.data)]);
}

/** Validates a manifest; throws a readable error for anything that isn't one. */
export function parseImageManifest(value: unknown): ImageManifest {
  if (typeof value !== "object" || value === null) throw new Error("The images file has no manifest.");
  const v = value as Record<string, unknown>;
  if (v.format !== IMAGE_ARCHIVE_FORMAT) throw new Error("The file is not a Kingdom 1241 images backup.");
  if (v.version !== IMAGE_ARCHIVE_VERSION) throw new Error(`Images backup version ${String(v.version)} is not supported (expected ${IMAGE_ARCHIVE_VERSION}).`);
  if (typeof v.createdAt !== "string" || Number.isNaN(Date.parse(v.createdAt))) throw new Error("The images backup has no valid createdAt.");
  if (typeof v.source !== "string") throw new Error("The images backup has no source.");
  if (!Array.isArray(v.files)) throw new Error("The images backup has no file list.");
  const seen = new Set<string>();
  const files = v.files.map((entry, index) => {
    const e = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
    if (typeof e.path !== "string" || !isImagePath(e.path)) throw new Error(`Image ${index + 1} has a path the bucket doesn't allow: ${String(e.path)}`);
    if (typeof e.bytes !== "number" || !Number.isInteger(e.bytes) || e.bytes < 0) throw new Error(`Image ${e.path} has no valid size.`);
    if (seen.has(e.path)) throw new Error(`Image ${e.path} is listed twice.`);
    seen.add(e.path);
    return { path: e.path, bytes: e.bytes };
  });
  return { format: IMAGE_ARCHIVE_FORMAT, version: IMAGE_ARCHIVE_VERSION, createdAt: v.createdAt, source: v.source, files };
}

export function unpackImages(archive: Buffer): ImageArchive {
  if (archive.length < 4) throw new Error("The images file is empty.");
  const headerLength = archive.readUInt32BE(0);
  if (headerLength > archive.length - 4) throw new Error("The images file is cut short.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(archive.subarray(4, 4 + headerLength).toString("utf8"));
  } catch {
    throw new Error("The images file's manifest is not JSON.");
  }
  const manifest = parseImageManifest(parsed);
  let offset = 4 + headerLength;
  const files = manifest.files.map((entry) => {
    const data = archive.subarray(offset, offset + entry.bytes);
    if (data.length !== entry.bytes) throw new Error(`The images file is cut short at ${entry.path}.`);
    offset += entry.bytes;
    return { path: entry.path, data: Buffer.from(data) };
  });
  if (offset !== archive.length) throw new Error("The images file holds bytes no image claims.");
  return { manifest, files };
}

/** The archived images the bucket doesn't hold: a restore uploads these and never overwrites a file. */
export function missingImages<T extends { path: string }>(archived: readonly T[], present: ReadonlySet<string>): T[] {
  return archived.filter((file) => !present.has(file.path));
}

export function totalImageBytes(files: ReadonlyArray<{ bytes: number }>): number {
  return files.reduce((sum, file) => sum + file.bytes, 0);
}

/** "12 images, 4.2 MB" for the log. */
export function summarizeImages(files: readonly ArchivedImage[]): string {
  return `${files.length} image${files.length === 1 ? "" : "s"}, ${formatBytes(totalImageBytes(files))}`;
}
