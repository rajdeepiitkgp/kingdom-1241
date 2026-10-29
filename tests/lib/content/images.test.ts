// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import {
  budgetProblem,
  fitWithin,
  foreignImages,
  IMAGE_BUDGET_BYTES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_HEIGHT,
  IMAGE_MAX_WIDTH,
  imagePath,
  imagePathFromUrl,
  imageProblem,
  imageSizeFromPath,
  imageUrl,
  imageUrls,
  isImageKind,
  referencedImagePaths,
  SHRINK_STEPS,
  sniffImage,
  stripJpegMetadata,
} from "@/lib/content/images";

const BASE = "https://abcdefghijklmnopqrst.supabase.co";
const ID = "0b0e7a52-5d0c-4c43-9f3e-2f6a1f4f6d11";

const bytes = (...parts: Array<string | number[]>) =>
  Uint8Array.from(parts.flatMap((part) => (typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part)));
const le32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const chunk = (id: string, data: number[]) => [...[...id].map((c) => c.charCodeAt(0)), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])];
const webp = (...chunks: number[][]) => {
  const body = chunks.flat();
  return bytes("RIFF", le32(4 + body.length), "WEBP", body);
};
const vp8 = (w: number, h: number) => chunk("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, w & 0xff, w >> 8, h & 0xff, h >> 8]);
const vp8l = (w: number, h: number) => chunk("VP8L", [0x2f, ...le32((w - 1) | ((h - 1) << 14))]);
const vp8x = (flags: number, w: number, h: number) => chunk("VP8X", [flags, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]);
const jpeg = (w: number, h: number, extra: number[] = []) =>
  bytes([0xff, 0xd8], [0xff, 0xe0, ...be16(16)], "JFIF\0", new Array(9).fill(0), extra, [0xff, 0xc0, ...be16(17), 8, ...be16(h), ...be16(w), 3], new Array(9).fill(0), [0xff, 0xda]);

describe("fitWithin", () => {
  it("keeps a phone screenshot at full size and scales bigger images down in proportion", () => {
    expect(fitWithin(1179, 2556)).toEqual({ width: 1179, height: 2556 });
    expect(fitWithin(4000, 3000)).toEqual({ width: IMAGE_MAX_WIDTH, height: 1200 });
    expect(fitWithin(1290, 5000)).toEqual({ width: 660, height: IMAGE_MAX_HEIGHT });
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });

  it("tries quality before size, and stops at a readable size", () => {
    expect(SHRINK_STEPS[0]).toEqual({ scale: 1, quality: 0.85 });
    for (let i = 1; i < SHRINK_STEPS.length; i++) expect(SHRINK_STEPS[i].scale).toBeLessThanOrEqual(SHRINK_STEPS[i - 1].scale);
    expect(SHRINK_STEPS.at(-1)!.scale).toBeGreaterThanOrEqual(0.4);
  });
});

describe("sniffImage", () => {
  it("reads lossy, lossless and extended WebP", () => {
    expect(sniffImage(webp(vp8(1179, 2556)))).toEqual({ type: "webp", width: 1179, height: 2556, metadata: false, animated: false });
    expect(sniffImage(webp(vp8l(640, 480)))).toEqual({ type: "webp", width: 640, height: 480, metadata: false, animated: false });
    expect(sniffImage(webp(vp8x(0x10, 800, 600), chunk("ALPH", [0, 0]), vp8(800, 600)))).toMatchObject({ width: 800, height: 600, metadata: false });
  });

  it("notices metadata and animation in WebP", () => {
    expect(sniffImage(webp(vp8x(0x08, 800, 600), vp8(800, 600)))?.metadata).toBe(true);
    expect(sniffImage(webp(vp8(800, 600), chunk("EXIF", [1, 2, 3, 4])))?.metadata).toBe(true);
    expect(sniffImage(webp(vp8x(0x02, 800, 600), chunk("ANIM", [0, 0, 0, 0, 0, 0])))?.animated).toBe(true);
  });

  it("reads JPEG and notices EXIF", () => {
    expect(sniffImage(jpeg(1600, 900))).toEqual({ type: "jpeg", width: 1600, height: 900, metadata: false, animated: false });
    const exif = [0xff, 0xe1, ...be16(10), ..."Exif\0\0".split("").map((c) => c.charCodeAt(0)), 0, 0];
    expect(sniffImage(jpeg(1600, 900, exif))?.metadata).toBe(true);
  });

  it("strips the metadata Safari writes into a JPEG, and leaves the rest alone", () => {
    const exif = [0xff, 0xe1, ...be16(10), ..."Exif\0\0".split("").map((c) => c.charCodeAt(0)), 0, 0];
    const photoshop = [0xff, 0xed, ...be16(6), 1, 2, 3, 4];
    const tagged = jpeg(300, 200, [...exif, ...photoshop]);
    const clean = stripJpegMetadata(tagged);
    expect(clean.length).toBe(tagged.length - exif.length - photoshop.length);
    expect(sniffImage(clean)).toEqual({ type: "jpeg", width: 300, height: 200, metadata: false, animated: false });
    expect(clean.subarray(-2)).toEqual(Uint8Array.from([0xff, 0xda]));
    const plain = jpeg(300, 200);
    expect(stripJpegMetadata(plain)).toEqual(plain);
    const notJpeg = webp(vp8(10, 10));
    expect(stripJpegMetadata(notJpeg)).toBe(notJpeg);
  });

  it("refuses everything else", () => {
    expect(sniffImage(bytes([0x89], "PNG\r\n\x1a\n", new Array(20).fill(0)))).toBeNull();
    expect(sniffImage(bytes("GIF89a", new Array(10).fill(0)))).toBeNull();
    expect(sniffImage(bytes("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(sniffImage(webp(vp8(800, 600)).subarray(0, 24))).toBeNull(); // cut short
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xda]))).toBeNull(); // no frame header
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("imageProblem", () => {
  const ok = { type: "webp" as const, width: 1179, height: 2556, metadata: false, animated: false };
  it("accepts what the editor makes", () => {
    expect(imageProblem(ok, 400_000)).toBeNull();
  });
  it("refuses big, foreign, animated, tagged or oversized files", () => {
    expect(imageProblem(ok, IMAGE_MAX_BYTES + 1)).toMatch(/over 900 KB/);
    expect(imageProblem(null, 1000)).toMatch(/Only images shrunk/);
    expect(imageProblem({ ...ok, animated: true }, 1000)).toMatch(/Animated/);
    expect(imageProblem({ ...ok, metadata: true }, 1000)).toMatch(/camera data/);
    expect(imageProblem({ ...ok, width: IMAGE_MAX_WIDTH + 1 }, 1000)).toMatch(/at most 1600 × 2560/);
    expect(imageProblem({ ...ok, height: IMAGE_MAX_HEIGHT + 1 }, 1000)).toMatch(/at most/);
    expect(imageProblem(ok, 0)).toMatch(/empty/);
  });
});

describe("budgetProblem", () => {
  it("lets images in until the budget is reached", () => {
    expect(budgetProblem(0, 500_000)).toBeNull();
    expect(budgetProblem(IMAGE_BUDGET_BYTES - 500_000, 500_000)).toBeNull();
    expect(budgetProblem(IMAGE_BUDGET_BYTES - 500_000, 500_001)).toMatch(/full \(500 MB\)/);
  });
});

describe("image names and addresses", () => {
  it("names a file after its id and size, and reads the size back", () => {
    const path = imagePath(ID, { type: "jpeg", width: 1179, height: 2556 });
    expect(path).toBe(`content/${ID}-1179x2556.jpg`);
    expect(imageSizeFromPath(path)).toEqual({ width: 1179, height: 2556 });
    expect(imageSizeFromPath("content/whatever.png")).toBeNull();
  });

  it("knows our own images by their address only", () => {
    const path = `content/${ID}-800x600.webp`;
    const url = imageUrl(`${BASE}/`, path);
    expect(url).toBe(`${BASE}/storage/v1/object/public/images/${path}`);
    expect(imagePathFromUrl(url, BASE)).toBe(path);
    expect(imagePathFromUrl(url, "https://other.supabase.co")).toBeNull();
    expect(imagePathFromUrl(url, undefined)).toBeNull();
    expect(imagePathFromUrl(`${BASE}/storage/v1/object/public/images/content/../secret.webp`, BASE)).toBeNull();
    expect(imagePathFromUrl("https://cdn.discordapp.com/attachments/1/2/a.png", BASE)).toBeNull();
  });

  it("finds the images a text uses and the ones from elsewhere", () => {
    const ours = imageUrl(BASE, `content/${ID}-800x600.webp`);
    const markdown = `Intro\n\n![A](${ours})\n\n![B](https://i.imgur.com/x.png "title")\n\n<img src="https://evil.example/y.jpg">`;
    expect(imageUrls(markdown)).toEqual([ours, "https://i.imgur.com/x.png", "https://evil.example/y.jpg"]);
    expect(foreignImages(markdown, BASE)).toEqual(["https://i.imgur.com/x.png", "https://evil.example/y.jpg"]);
    expect(referencedImagePaths([markdown, `<img src="${ours}">`, "nothing"])).toEqual(new Set([`content/${ID}-800x600.webp`]));
  });

  it("knows the kinds of text", () => {
    expect(isImageKind("guide")).toBe(true);
    expect(isImageKind("toString")).toBe(false);
  });
});
