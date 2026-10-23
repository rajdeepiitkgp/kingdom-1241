import { describe, expect, it } from "vitest";
import { htmlToExcerpt, markdownToHtml, sanitizeRichText } from "./html";

describe("sanitizeRichText", () => {
  it("strips scripts, event handlers and javascript: links", () => {
    const dirty = `<p onclick="x()">Hi <a href="javascript:alert(1)">bad</a><script>alert(1)</script></p>`;
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<p>Hi ");
  });

  it("keeps tables, headings, lists and images; external links open safely", () => {
    const html = `<h2>T</h2><table><tr><th>a</th><td>b</td></tr></table><ul><li>x</li></ul><img src="https://x/y.png" alt="p"><a href="https://example.com">e</a>`;
    const clean = sanitizeRichText(html);
    expect(clean).toContain("<h2>T</h2>");
    expect(clean).toContain("<table>");
    expect(clean).toContain('loading="lazy"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('target="_blank"');
  });
});

describe("markdownToHtml", () => {
  it("renders GFM tables and bold text", () => {
    const html = markdownToHtml("## Title\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n**bold**");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>bold</strong>");
  });
});

describe("htmlToExcerpt", () => {
  it("flattens html to a short plain string", () => {
    expect(htmlToExcerpt("<p>Hello&nbsp;<b>world</b></p>", 50)).toBe("Hello world");
    expect(htmlToExcerpt("<p>" + "word ".repeat(100) + "</p>", 20).endsWith("…")).toBe(true);
  });
});
