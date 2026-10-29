import { describe, expect, it } from "vitest";
import {
  announcementLive,
  bodyImageProblem,
  bodySourceFor,
  isContentOrderTable,
  lockedPageImageProblem,
  parseAnnouncementForm,
  parseGuideForm,
  parseGuideSectionForm,
  parseRuleForm,
  parseRuleTopicForm,
} from "@/lib/admin/content-forms";
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

const TOPIC = "0b0e7a52-5d0c-4c43-9f3e-2f6a1f4f6d11";

describe("parseRuleTopicForm", () => {
  it("makes the address from the name and keeps a typed one", () => {
    expect(parseRuleTopicForm(form({ title: "Attacks & tiles", icon: "🛡️", published: "on" }))).toEqual({
      ok: true,
      value: { title: "Attacks & tiles", icon: "🛡️", slug: "attacks-tiles", published: true },
    });
    const typed = parseRuleTopicForm(form({ title: "Attacks", slug: " KvK Rules! " }));
    expect(typed.ok && typed.value).toMatchObject({ slug: "kvk-rules", icon: "📜", published: false });
  });

  it("wants a name, one emoji and an address with a letter or digit", () => {
    const result = parseRuleTopicForm(form({ title: "", icon: "a long text" }));
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["icon", "title"]);
    const noSlug = parseRuleTopicForm(form({ title: "Règles", slug: "!!!" }));
    expect(!noSlug.ok && noSlug.errors.slug).toMatch(/at least one letter/);
    expect(parseRuleTopicForm(form({ title: "Families", icon: "👨‍👩‍👧‍👦" })).ok).toBe(true);
  });
});

describe("parseRuleForm", () => {
  it("reads a rule with its topic and text", () => {
    const result = parseRuleForm(form({ topicId: TOPIC, title: "No attacks", bodySource: "Never **inside** 1241.\r\n", published: "on" }), { supabaseUrl: BASE });
    expect(result).toEqual({ ok: true, value: { topicId: TOPIC, title: "No attacks", bodySource: "Never **inside** 1241.", published: true } });
  });

  it("wants a topic, a title and an explanation, with at most three images", () => {
    const empty = parseRuleForm(form({ topicId: "nope", title: "", bodySource: "" }), { supabaseUrl: BASE });
    expect(!empty.ok && Object.keys(empty.errors).sort()).toEqual(["bodySource", "title", "topicId"]);
    const four = parseRuleForm(form({ topicId: TOPIC, title: "Map", bodySource: [1, 2, 3, 4].map(image).join("\n\n") }), { supabaseUrl: BASE });
    expect(!four.ok && four.errors.bodySource).toMatch(/At most 3 images in a rule/);
  });
});

describe("parseGuideForm", () => {
  it("reads a guide and folds the summary onto one line", () => {
    const result = parseGuideForm(form({ title: "Bear Hunt", summary: "Rally the bear.\nEvery two days.", icon: "🐻", bodySource: "## How", published: "on" }), {
      supabaseUrl: BASE,
    });
    expect(result).toEqual({
      ok: true,
      value: { title: "Bear Hunt", summary: "Rally the bear. Every two days.", icon: "🐻", slug: "bear-hunt", bodySource: "## How", published: true },
    });
  });

  it("wants a summary and allows ten images", () => {
    const ten = Array.from({ length: 10 }, (_, i) => image(i)).join("\n");
    const result = parseGuideForm(form({ title: "Swordland", summary: "", bodySource: ten }), { supabaseUrl: BASE });
    expect(!result.ok && Object.keys(result.errors)).toEqual(["summary"]);
  });
});

describe("parseGuideSectionForm", () => {
  const options = { supabaseUrl: BASE, isNew: true, allianceTags: ["NAM", "Nam", "ULU"], taken: ["NAM"] };

  it("takes an alliance from the list, with its exact case", () => {
    expect(parseGuideSectionForm(form({ allianceTag: "Nam", bodySource: "We send at 20:00.", published: "on" }), options)).toEqual({
      ok: true,
      value: { allianceTag: "Nam", bodySource: "We send at 20:00.", published: true },
    });
    const unknown = parseGuideSectionForm(form({ allianceTag: "ulu", bodySource: "x" }), options);
    expect(!unknown.ok && unknown.errors.allianceTag).toMatch(/isn't on the alliance list/);
  });

  it("refuses a second section for an alliance, and keeps an existing section's alliance", () => {
    const twice = parseGuideSectionForm(form({ allianceTag: "NAM", bodySource: "x" }), options);
    expect(!twice.ok && twice.errors.allianceTag).toMatch(/already has a section/);
    const existing = parseGuideSectionForm(form({ allianceTag: "ULU", bodySource: "Edited" }), { ...options, isNew: false });
    expect(existing.ok && existing.value.allianceTag).toBeNull();
  });
});

describe("isContentOrderTable", () => {
  it("knows the lists the arrows reorder", () => {
    expect(["rule_topics", "rules", "guides"].every(isContentOrderTable)).toBe(true);
    expect(isContentOrderTable("guide_sections")).toBe(false);
    expect(isContentOrderTable("kvk_rules")).toBe(false);
  });
});
