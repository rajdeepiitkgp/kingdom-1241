// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { unusedImages } from "@/lib/content/image-store";
import { ORPHAN_GRACE_MS } from "@/lib/content/images";

describe("unusedImages", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const old = new Date(now.getTime() - ORPHAN_GRACE_MS - 1000).toISOString();
  const fresh = new Date(now.getTime() - 60_000).toISOString();

  it("deletes only images that are in no text and older than a day", () => {
    const images = [
      { path: "content/a-1x1.webp", createdAt: old }, // unused, old → deleted
      { path: "content/b-1x1.webp", createdAt: old }, // still in a text
      { path: "content/c-1x1.webp", createdAt: fresh }, // just uploaded, text not saved yet
    ];
    expect(unusedImages(images, new Set(["content/b-1x1.webp"]), now)).toEqual(["content/a-1x1.webp"]);
  });

  it("keeps everything when a date can't be read", () => {
    expect(unusedImages([{ path: "content/a-1x1.webp", createdAt: "" }], new Set(), now)).toEqual([]);
  });
});
