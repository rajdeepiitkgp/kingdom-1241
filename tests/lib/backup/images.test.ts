import { describe, expect, it } from "vitest";
import { decryptBytes, encryptBytes, imageBackupFileName, imagesFileFor } from "@/lib/backup/crypto";
import { imageContentType, isImagePath, missingImages, packImages, parseImageManifest, summarizeImages, unpackImages } from "@/lib/backup/images";

const UUID = "6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const WEBP = `content/${UUID}-800x600.webp`;
const JPG = `content/${UUID.replace("6f1c", "7a2d")}-1600x2560.jpg`;
const NOW = new Date("2026-11-10T04:17:22.000Z");

const binary = (seed: number, length: number) => Buffer.from(Array.from({ length }, (_, i) => (seed * 31 + i * 7) & 0xff));

describe("image archive", () => {
  it("round-trips files with any bytes, in order, with their sizes in the manifest", () => {
    const files = [
      { path: WEBP, data: binary(1, 1000) },
      { path: JPG, data: Buffer.concat([Buffer.from([0, 0xff, 0]), binary(2, 50)]) },
    ];
    const archive = packImages(files, "db.example.supabase.co", NOW);
    const out = unpackImages(archive);
    expect(out.manifest.source).toBe("db.example.supabase.co");
    expect(out.manifest.createdAt).toBe("2026-11-10T04:17:22.000Z");
    expect(out.manifest.files).toEqual([
      { path: WEBP, bytes: 1000 },
      { path: JPG, bytes: 53 },
    ]);
    expect(out.files.map((f) => f.path)).toEqual([WEBP, JPG]);
    expect(out.files[0].data.equals(files[0].data)).toBe(true);
    expect(out.files[1].data.equals(files[1].data)).toBe(true);
  });

  it("packs an empty bucket as an empty archive", () => {
    const out = unpackImages(packImages([], "x", NOW));
    expect(out.files).toEqual([]);
    expect(summarizeImages(out.manifest.files)).toBe("0 images, 0 kB");
  });

  it("survives encryption like the table dump", () => {
    const archive = packImages([{ path: WEBP, data: binary(3, 300) }], "x", NOW);
    const file = encryptBytes(archive, "correct horse battery staple 1241");
    expect(file.includes(binary(3, 300).subarray(0, 32))).toBe(false);
    expect(unpackImages(decryptBytes(file, "correct horse battery staple 1241")).files[0].data.equals(binary(3, 300))).toBe(true);
  });

  it("refuses a cut, padded or damaged archive", () => {
    const archive = packImages([{ path: WEBP, data: binary(1, 100) }], "x", NOW);
    expect(() => unpackImages(archive.subarray(0, archive.length - 1))).toThrow(/cut short/);
    expect(() => unpackImages(Buffer.concat([archive, Buffer.from([1])]))).toThrow(/no image claims/);
    expect(() => unpackImages(Buffer.from([0, 0, 0, 2, 123]))).toThrow(/cut short/);
    expect(() => unpackImages(Buffer.from([0, 0, 0, 1, 123]))).toThrow(/not JSON/);
    expect(() => unpackImages(Buffer.alloc(2))).toThrow(/empty/);
  });

  it("refuses a manifest with a path outside the bucket's rule, a duplicate or a bad size", () => {
    const base = { format: "kingdom-1241-images", version: 1, createdAt: NOW.toISOString(), source: "x" };
    expect(() => parseImageManifest({ ...base, files: [{ path: "../etc/passwd", bytes: 1 }] })).toThrow(/doesn't allow/);
    expect(() => parseImageManifest({ ...base, files: [{ path: "avatars/x.webp", bytes: 1 }] })).toThrow(/doesn't allow/);
    expect(() => parseImageManifest({ ...base, files: [{ path: WEBP, bytes: 1 }, { path: WEBP, bytes: 1 }] })).toThrow(/twice/);
    expect(() => parseImageManifest({ ...base, files: [{ path: WEBP, bytes: -1 }] })).toThrow(/size/);
    expect(() => parseImageManifest({ ...base, files: [{ path: WEBP, bytes: 1.5 }] })).toThrow(/size/);
    expect(() => parseImageManifest({ ...base, version: 2, files: [] })).toThrow(/version 2/);
    expect(() => parseImageManifest({ format: "other", files: [] })).toThrow(/not a Kingdom 1241/);
    expect(() => packImages([{ path: "content/x.png", data: Buffer.alloc(1) }], "x", NOW)).toThrow(/doesn't allow/);
  });

  it("knows the bucket's paths and their types", () => {
    expect(isImagePath(WEBP)).toBe(true);
    expect(isImagePath(JPG)).toBe(true);
    expect(isImagePath(`content/${UUID}-800x600.png`)).toBe(false);
    expect(isImagePath(`${UUID}-800x600.webp`)).toBe(false);
    expect(imageContentType(WEBP)).toBe("image/webp");
    expect(imageContentType(JPG)).toBe("image/jpeg");
  });

  it("uploads only what the bucket lacks", () => {
    const archived = [{ path: WEBP }, { path: JPG }];
    expect(missingImages(archived, new Set([WEBP]))).toEqual([{ path: JPG }]);
    expect(missingImages(archived, new Set([WEBP, JPG]))).toEqual([]);
    expect(missingImages(archived, new Set())).toEqual(archived);
  });

  it("names the images file after the table dump of the same run", () => {
    expect(imageBackupFileName(NOW)).toBe("kingdom-1241-2026-11-10T041722Z.images.enc");
    expect(imagesFileFor("backups/kingdom-1241-2026-11-10T041722Z.json.enc")).toBe("backups/kingdom-1241-2026-11-10T041722Z.images.enc");
    expect(imagesFileFor("backups/dump.json")).toBeNull();
  });

  it("summarises for the log", () => {
    expect(summarizeImages([{ path: WEBP, bytes: 600 * 1024 }])).toBe("1 image, 600 kB");
    expect(summarizeImages([{ path: WEBP, bytes: 1 }, { path: JPG, bytes: 2 }])).toBe("2 images, 1 kB");
  });
});
