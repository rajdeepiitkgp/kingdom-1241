import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { htmlToExcerpt, linkImages, markdownToHtml, sanitizeRichText } from "@/lib/html";

const BASE = "https://abcdefghijklmnopqrst.supabase.co";
const OURS = `${BASE}/storage/v1/object/public/images/content/0b0e7a52-5d0c-4c43-9f3e-2f6a1f4f6d11-1179x2556.webp`;

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE));
afterEach(() => vi.unstubAllEnvs());

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
    const html = `<h2>T</h2><table><tr><th>a</th><td>b</td></tr></table><ul><li>x</li></ul><img src="${OURS}" alt="p"><a href="https://example.com">e</a>`;
    const clean = sanitizeRichText(html);
    expect(clean).toContain("<h2>T</h2>");
    expect(clean).toContain("<table>");
    expect(clean).toContain('loading="lazy"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('target="_blank"');
  });

  it("keeps only our own images, with their size", () => {
    const clean = sanitizeRichText(`<p><img src="${OURS}" alt="ours"><img src="https://i.imgur.com/x.png" alt="theirs"><img src="/items/x.webp" alt="site"><img src="//evil.example/x.png"></p>`);
    expect(clean).toContain('width="1179"');
    expect(clean).toContain('height="2556"');
    expect(clean).toContain('src="/items/x.webp"');
    expect(clean).not.toContain("imgur");
    expect(clean).not.toContain("evil");
  });

  it("turns a pasted # heading into a section heading", () => {
    expect(sanitizeRichText("<h1>Big</h1><h6>small</h6>")).toBe("<h2>Big</h2><h4>small</h4>");
  });
});

describe("linkImages", () => {
  it("links images to their full size and sizes them to the column and the height cap", () => {
    const html = linkImages(sanitizeRichText(`<p><img src="${OURS}" alt="tall"></p>`));
    expect(html).toContain(`<a class="image-link" href="${OURS}" target="_blank" rel="noopener noreferrer"><img style="width:min(100%,1179px,12.915rem)"`);
  });

  it("leaves images that already sit in a link unwrapped", () => {
    const html = linkImages(`<a href="https://example.com"><img src="/a.webp"></a><img src="/b.webp">`);
    expect(html).toBe(`<a href="https://example.com"><img src="/a.webp"></a><a class="image-link" href="/b.webp" target="_blank" rel="noopener noreferrer"><img src="/b.webp"></a>`);
  });
});

describe("markdownToHtml", () => {
  it("renders GFM tables and bold text", () => {
    const html = markdownToHtml("## Title\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n**bold**");
    expect(html).toContain("<h2>Title</h2>");
    expect(html).toContain("<table>");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("makes a quote opening with [!DANGER] the red box, the marker on its own line or before the text", () => {
    const red = '<blockquote class="danger">\n<p>Never hit first.</p>\n</blockquote>\n';
    expect(markdownToHtml("> [!DANGER]\n> Never hit first.")).toBe(red);
    expect(markdownToHtml("> [!danger] Never hit first.")).toBe(red);
    expect(markdownToHtml("> [!CAUTION]\n>\n> Never hit first.")).toBe(red);
    // A plain quote stays the gold box.
    expect(markdownToHtml("> Hold the line.")).toBe("<blockquote>\n<p>Hold the line.</p>\n</blockquote>\n");
  });

  it("keeps the danger class only, nowhere else", () => {
    expect(sanitizeRichText('<blockquote class="danger evil"><p class="danger">x</p></blockquote>')).toBe('<blockquote class="danger"><p>x</p></blockquote>');
  });
});

describe("htmlToExcerpt", () => {
  it("flattens html to a short plain string", () => {
    expect(htmlToExcerpt("<p>Hello&nbsp;<b>world</b></p>", 50)).toBe("Hello world");
    expect(htmlToExcerpt("<p>" + "word ".repeat(100) + "</p>", 20).endsWith("…")).toBe(true);
  });
});
