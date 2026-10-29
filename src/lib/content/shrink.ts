// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { fitWithin, IMAGE_MAX_BYTES, IMAGE_MIME, IMAGE_TARGET_BYTES, type ImageType, SHRINK_STEPS } from "./images";

/**
 * Shrinks an image in the browser before it is uploaded (the editor's image
 * button, paste and drop): decoded the right way up, drawn at most
 * IMAGE_MAX_WIDTH × IMAGE_MAX_HEIGHT and encoded as WebP, or JPEG where the
 * browser can't write WebP (Safari), trying SHRINK_STEPS until the file is
 * under IMAGE_TARGET_BYTES. Drawing on a canvas leaves the photo's metadata
 * (camera, location) behind. Where a browser lacks a part of this,
 * `canShrinkImages` is false and the editor shows no image button.
 */

let supported: boolean | undefined;

/** True where the browser can decode, draw and encode an image (checked once). */
export function canShrinkImages(): boolean {
  if (supported === undefined) {
    try {
      const canvas = document.createElement("canvas");
      supported = typeof canvas.toBlob === "function" && Boolean(canvas.getContext("2d")) && typeof URL.createObjectURL === "function";
    } catch {
      supported = false;
    }
  }
  return supported;
}

let webp: boolean | undefined;

function canWriteWebp(): boolean {
  if (webp === undefined) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      // A browser that can't write WebP silently writes PNG instead.
      webp = canvas.toDataURL(IMAGE_MIME.webp).startsWith(`data:${IMAGE_MIME.webp}`);
    } catch {
      webp = false;
    }
  }
  return webp;
}

/** A problem worth telling the moderator; anything else is reported as a general failure. */
export class ShrinkError extends Error {}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Some browsers can't decode every format this way: the <img> route below can.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("decode failed"));
      image.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function encode(canvas: HTMLCanvasElement, type: ImageType, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, IMAGE_MIME[type], quality));
}

export interface ShrunkImage {
  blob: Blob;
  type: ImageType;
  width: number;
  height: number;
}

export async function shrinkImage(file: Blob): Promise<ShrunkImage> {
  let image: Decoded;
  try {
    image = await decode(file);
  } catch {
    throw new ShrinkError("This browser can't open that file as an image. Try a screenshot (PNG or JPEG).");
  }
  try {
    if (!image.width || !image.height) throw new ShrinkError("That image is empty.");
    const type: ImageType = canWriteWebp() ? "webp" : "jpeg";
    const fit = fitWithin(image.width, image.height);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new ShrinkError("This browser can't shrink images.");
    let smallest: ShrunkImage | null = null;
    for (const step of SHRINK_STEPS) {
      const width = Math.max(1, Math.round(fit.width * step.scale));
      const height = Math.max(1, Math.round(fit.height * step.scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        context.imageSmoothingQuality = "high";
        // JPEG has no transparency: transparent parts would turn black.
        if (type === "jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, width, height);
        }
        context.drawImage(image.source, 0, 0, width, height);
      }
      const blob = await encode(canvas, type, step.quality);
      if (!blob || blob.type !== IMAGE_MIME[type]) continue;
      // The steps go from best to smallest: the first one under the target is the one to keep.
      if (blob.size <= IMAGE_TARGET_BYTES) return { blob, type, width, height };
      if (!smallest || blob.size < smallest.blob.size) smallest = { blob, type, width, height };
    }
    if (!smallest || smallest.blob.size > IMAGE_MAX_BYTES) throw new ShrinkError("This image stays too large even after shrinking. Crop it and try again.");
    return smallest;
  } finally {
    image.release();
  }
}
