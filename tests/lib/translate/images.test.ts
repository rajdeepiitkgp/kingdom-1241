// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { imagePlaces, restoreImages, shieldImages } from "@/lib/translate/images";

const A = '<img src="https://x.supabase.co/storage/v1/object/public/images/content/0b0e7a52-5d0c-4c43-9f3e-2f6a1f4f6d11-800x600.webp" alt="Trap" width="800" height="600" loading="lazy">';
const B = '<img src="/items/speedup.webp" alt="Speedup">';
const SOURCE = `<p>Look:</p><p>${A}</p><ul><li>and ${B} here</li></ul><p>End</p>`;

describe("shieldImages / restoreImages", () => {
  it("sends placeholders instead of images and puts the images back in place", () => {
    const shielded = shieldImages(SOURCE);
    expect(shielded.text).toBe("<p>Look:</p><p>{{img:0}}</p><ul><li>and {{img:1}} here</li></ul><p>End</p>");
    expect(shielded.text).not.toContain("supabase");
    const translated = "<p>Schau:</p><p>{{img:0}}</p><ul><li>und hier {{ img:1 }}</li></ul><p>Ende</p>";
    expect(restoreImages(translated, shielded)).toBe(`<p>Schau:</p><p>${A}</p><ul><li>und hier ${B}</li></ul><p>Ende</p>`);
  });

  it("refuses an answer that lost, repeated, swapped or moved an image", () => {
    const shielded = shieldImages(SOURCE);
    const refused = [
      "<p>Schau:</p><p></p><ul><li>und {{img:1}} hier</li></ul><p>Ende</p>", // lost
      "<p>Schau:</p><p>{{img:0}}</p><ul><li>und {{img:1}} {{img:1}}</li></ul><p>Ende</p>", // repeated
      "<p>Schau:</p><p>{{img:1}}</p><ul><li>und {{img:0}} hier</li></ul><p>Ende</p>", // swapped
      "<p>Schau:</p><ul><li>und {{img:1}} hier</li></ul><p>{{img:0}}</p><p>Ende</p>", // moved to another block
      "<p>Schau: {{img:0}}</p><ul><li>und {{img:1}} hier</li></ul><p>Ende</p>", // pulled into the paragraph before
      "<p>Schau:</p><p>{{img:0}}</p><ul><li>und {{img:1}} hier</li></ul><p>Ende {{img:2}}</p>", // made up
    ];
    for (const answer of refused) expect(restoreImages(answer, shielded), answer).toBeNull();
  });

  it("leaves texts without images alone, but refuses an invented image", () => {
    const plain = shieldImages("<p>No images, {{when}} stays</p>");
    expect(plain).toEqual({ text: "<p>No images, {{when}} stays</p>", images: [] });
    expect(restoreImages("<p>Keine Bilder, {{when}} bleibt</p>", plain)).toBe("<p>Keine Bilder, {{when}} bleibt</p>");
    expect(restoreImages("<p>{{img:0}}</p>", plain)).toBeNull();
  });

  it("places images by top-level block, void tags included", () => {
    expect(imagePlaces("<p>a</p><hr><p>{{img:0}}</p>{{img:1}}<table><tr><td>{{img:2}}</td></tr></table>")).toEqual(["0@2", "1@2.5", "2@3"]);
  });
});
