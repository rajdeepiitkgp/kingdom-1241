import { describe, expect, it } from "vitest";
import { announcementLive, bodyImageProblem, bodySourceFor, lockedPageImageProblem, parseAnnouncementForm } from "@/lib/admin/content-forms";
import { parsePlanForm } from "@/lib/admin/kvk-forms";

const BASE = "https://abcdefghijklmnopqrst.supabase.co";
const image = (n: number) => `![shot ${n}](${BASE}/storage/v1/object/public/images/content/0b0e7a52-5d0c-4c43-9f3e-2f6a1f4f6d1${n}-800x600.webp)`;

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
};

describe("parseAnnouncementForm", () => {
  it("reads a complete announcement", () => {
    const result = parseAnnouncementForm(
      form({ title: " Bear Hunt moved ", bodySource: "**Today** at 20:00 UTC\r\n\r\n" + image(1), published: "on", expiresAt: "2026-11-01T20:00" }),
      { supabaseUrl: BASE },
    );
    expect(result).toEqual({
      ok: true,
      value: { title: "Bear Hunt moved", bodySource: `**Today** at 20:00 UTC\n\n${image(1)}`, pinned: false, published: true, expiresAt: "2026-11-01T20:00:00.000Z" },
    });
  });

  it("asks for a title and a text, and checks the expiry", () => {
    const result = parseAnnouncementForm(form({ title: "", bodySource: "  ", expiresAt: "tomorrow" }), { supabaseUrl: BASE });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["bodySource", "expiresAt", "title"]);
  });

  it("refuses a fourth image and images from other sites", () => {
    const four = [1, 2, 3, 4].map(image).join("\n\n");
    const tooMany = parseAnnouncementForm(form({ title: "T", bodySource: four }), { supabaseUrl: BASE });
    expect(!tooMany.ok && tooMany.errors.bodySource).toMatch(/At most 3 images in an announcement \(this text has 4\)/);
    const foreign = parseAnnouncementForm(form({ title: "T", bodySource: "![x](https://i.imgur.com/a.png)" }), { supabaseUrl: BASE });
    expect(!foreign.ok && foreign.errors.bodySource).toMatch(/other sites/);
  });
});

describe("bodyImageProblem", () => {
  it("allows ten images in a guide", () => {
    const ten = Array.from({ length: 10 }, (_, i) => image(i)).join("\n");
    expect(bodyImageProblem(ten, "guide", BASE)).toBeNull();
    expect(bodyImageProblem(ten, "rule", BASE)).toMatch(/At most 3 images in a rule/);
  });
});

describe("lockedPageImageProblem", () => {
  it("keeps images off the password-locked pages", () => {
    expect(lockedPageImageProblem("No images here")).toBeNull();
    expect(lockedPageImageProblem(image(1))).toMatch(/password-locked/);
    const plan = parsePlanForm(form({ title: "Castle battle", eventType: "castle_battle", introSource: image(1), minHeroStars: "0", minSkillLevel: "0" }), {
      now: new Date("2026-10-29T00:00:00Z"),
      previousBattleAt: null,
    });
    expect(!plan.ok && plan.errors.introSource).toMatch(/password-locked/);
  });
});

describe("bodySourceFor", () => {
  it("opens the stored Markdown, else the HTML turned back into Markdown", () => {
    expect(bodySourceFor({ body: { en: "<p>x</p>" }, bodySource: { en: "**kept**" } }, "en")).toBe("**kept**");
    expect(bodySourceFor({ body: { de: "<p><strong>Heute</strong></p>" }, bodySource: {} }, "de")).toBe("**Heute**");
    expect(bodySourceFor({ body: null, bodySource: null }, "pl")).toBe("");
  });
});

describe("announcementLive", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  it("is live while published and not expired", () => {
    expect(announcementLive({ published: true, expiresAt: null }, now)).toBe(true);
    expect(announcementLive({ published: true, expiresAt: "2026-10-30T00:00:00Z" }, now)).toBe(true);
    expect(announcementLive({ published: true, expiresAt: "2026-10-29T11:59:00Z" }, now)).toBe(false);
    expect(announcementLive({ published: false, expiresAt: null }, now)).toBe(false);
  });
});
