// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_ANNOUNCEMENTS } from "@/content/seed/announcements";
import { SEED_GUIDES } from "@/content/seed/guides";
import { SEED_CHECKLIST, SEED_KVK_PLAN, SEED_LEADER_BRIEF } from "@/content/seed/kvk";
import { SEED_RULE_TOPICS } from "@/content/seed/rules";
import { htmlToMarkdown } from "@/lib/content/html-to-markdown";
import { markdownToHtml } from "@/lib/html";

const BASE = "https://abcdefghijklmnopqrst.supabase.co";
const IMAGE = `${BASE}/storage/v1/object/public/images/content/0b0e7a52-5d0c-4c43-9f3e-2f6a1f4f6d11-1179x2556.webp`;

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE));
afterEach(() => vi.unstubAllEnvs());

/** Markdown → HTML → Markdown → HTML must give the same HTML: nothing is lost by opening a text in the editor. */
function roundTrips(markdown: string) {
  const html = markdownToHtml(markdown);
  expect(markdownToHtml(htmlToMarkdown(html))).toBe(html);
}

describe("htmlToMarkdown", () => {
  it("keeps every seed text intact", () => {
    const texts = [
      ...SEED_ANNOUNCEMENTS.map((a) => a.bodyMarkdown),
      ...SEED_RULE_TOPICS.flatMap((topic) => topic.rules.map((rule) => rule.bodyMarkdown)),
      ...SEED_GUIDES.map((guide) => guide.bodyMarkdown),
      SEED_KVK_PLAN.introMarkdown,
      SEED_LEADER_BRIEF.introMarkdown,
      SEED_CHECKLIST.introMarkdown,
    ];
    expect(texts.length).toBeGreaterThan(10);
    for (const text of texts) roundTrips(text);
  });

  it("writes the red box back with its marker", () => {
    const html = markdownToHtml("> [!DANGER] **Never** hit first.\n>\n> - or you burn");
    expect(htmlToMarkdown(html)).toBe("> [!DANGER]\n> **Never** hit first.\n>\n> - or you burn");
    roundTrips("> [!DANGER]\n> Never hit first.");
    roundTrips("> Gold stays gold.");
  });

  it("writes tables, alignment included", () => {
    const html = markdownToHtml("| Gen | Ratio |\n| :--- | ---: |\n| 1 | 10 / 30 / 60 |\n| 2 | a \\| b |");
    expect(htmlToMarkdown(html)).toBe("| Gen | Ratio |\n| :--- | ---: |\n| 1 | 10 / 30 / 60 |\n| 2 | a \\| b |");
  });

  it("writes nested and numbered lists, loose and tight", () => {
    roundTrips("1. First\n2. Second\n   - inner\n   - inner two\n3. Third");
    roundTrips("- One\n\n- Two\n\n  More about two.\n\n- Three");
    roundTrips("3. starts at three\n4. four");
  });

  it("keeps links, our images and their descriptions", () => {
    const markdown = `See [the guide](https://example.com/a_b?x=1) and:\n\n![Bear trap (map)](${IMAGE})`;
    const html = markdownToHtml(markdown);
    expect(htmlToMarkdown(html)).toBe(markdown);
  });

  it("keeps a link's hover title with quotes and backslashes in it", () => {
    roundTrips('Read [the rules](https://example.com/r "Say \\"hi\\" to C:\\\\")');
    expect(htmlToMarkdown('<p><a href="https://example.com/r" title="ends in \\">rules</a></p>')).toBe('[rules](https://example.com/r "ends in \\\\")');
  });

  it("escapes what would turn into formatting, and leaves alliance tags alone", () => {
    roundTrips("Price: 5 \\* 3, not *italic*; `code` and \\`ticks\\`.");
    roundTrips("\\- not a list\n\n\\# not a heading\n\n1\\. not numbered");
    roundTrips("snake_case_name stays, \\_edge\\_ escaped");
    roundTrips("Ask [KvK] or [TMP] first. Literal \\[x\\](y) is not a link.");
    expect(htmlToMarkdown(markdownToHtml("Ask [KvK] or [TMP] first."))).toBe("Ask [KvK] or [TMP] first.");
    roundTrips("Entities: &lt;b&gt; stays text, AT&amp;T, 5 < 6 > 4");
  });

  it("keeps quotes, code blocks, rules and line breaks", () => {
    roundTrips("> Council: edit me.\n>\n> Second paragraph with **bold**.");
    roundTrips("```\nconst a = 1;\n\n  indented\n```");
    roundTrips("Above\n\n---\n\nBelow");
    roundTrips("Line one\\\nline two");
    roundTrips("## Heading with *em*\n\n### Sub\n\n#### Small");
  });

  it("turns a stray h1 into a section heading", () => {
    expect(htmlToMarkdown("<h1>Big</h1><p>x</p>")).toBe("## Big\n\nx");
  });

  it("matches what the plan editor showed before for simple texts", () => {
    const html =
      "<p>Hi all! 👋 <strong>Castle Battle tomorrow</strong></p><ul><li>No buffs</li><li>Listen to <em>coordinators</em></li></ul><blockquote><p>Council: edit me.</p></blockquote>";
    expect(htmlToMarkdown(html)).toBe("Hi all! 👋 **Castle Battle tomorrow**\n\n- No buffs\n- Listen to *coordinators*\n\n> Council: edit me.");
  });

  it("copes with machine-translated and odd HTML", () => {
    expect(htmlToMarkdown("<p>Bonjour <strong> les amis </strong>!</p>")).toBe("Bonjour **les amis** !");
    expect(htmlToMarkdown("<p>open <em>never closed</p><p>next</p>")).toBe("open *never closed*\n\nnext");
    expect(htmlToMarkdown("plain text, no tags")).toBe("plain text, no tags");
    expect(htmlToMarkdown("")).toBe("");
  });
});
