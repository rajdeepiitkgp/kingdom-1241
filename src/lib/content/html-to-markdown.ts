// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Stored HTML back to Markdown (pure), for opening a text in the editor that
 * has no Markdown of its own: a row written as HTML (the seed), or a machine
 * translation (the pipeline translates the HTML only). It covers what the
 * sanitiser lets through (headings, paragraphs, emphasis, links, images,
 * lists, quotes, code, rules and tables), so Markdown → HTML → Markdown → HTML
 * gives the same HTML (a test runs every seed text through it); anything
 * else keeps its text.
 */

interface Element {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}
type Node = Element | string;

const VOID = new Set(["br", "hr", "img"]);
const BLOCK = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre", "hr", "table", "figure", "div", "figcaption", "caption"]);

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of source.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

/** A forgiving tree of the HTML: unknown closing tags are ignored, unclosed ones close at their parent's end. */
function parse(html: string): Element {
  const root: Element = { tag: "root", attrs: {}, children: [] };
  const stack: Element[] = [root];
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+|<)/g)) {
    const top = stack[stack.length - 1];
    if (match[4] !== undefined) {
      top.children.push(decode(match[4]));
      continue;
    }
    if (!match[2]) continue; // a comment
    const tag = match[2].toLowerCase();
    if (match[1]) {
      const index = stack.findLastIndex((element) => element.tag === tag);
      if (index > 0) stack.length = index;
      continue;
    }
    const element: Element = { tag, attrs: parseAttrs(match[3]), children: [] };
    top.children.push(element);
    if (!VOID.has(tag) && !match[3].trim().endsWith("/")) stack.push(element);
  }
  return root;
}

const isBlock = (node: Node) => typeof node !== "string" && BLOCK.has(node.tag);

/** Text with the characters escaped that Markdown would read as formatting. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([*`])/g, "\\$1")
    // Brackets stay as they are ([KvK] is everywhere) unless they would make a link.
    .replace(/\](?=\()/g, "\\]")
    .replace(/(^|[^\p{L}\p{N}])_|_(?=[^\p{L}\p{N}]|$)/gu, (match) => match.replace("_", "\\_"))
    .replace(/&(?=[#\w]+;)/g, "&amp;")
    .replace(/<(?=[a-zA-Z/!?])/g, "&lt;");
}

/** Escapes what would start a block at the beginning of a line (a heading, a quote, a list item, a rule). */
function escapeLineStarts(text: string): string {
  return text.replace(/^(\s*)([#>+-]|\d+(?=[.)]))/gm, (_, space: string, mark: string) => `${space}${/^\d/.test(mark) ? `${mark}\\` : `\\${mark}`}`);
}

function textOf(node: Node): string {
  return typeof node === "string" ? node : node.children.map(textOf).join("");
}

function destination(url: string): string {
  return /[\s()<>]/.test(url) ? `<${url.replace(/>/g, "%3E")}>` : url;
}

function title(attrs: Record<string, string>): string {
  return attrs.title ? ` "${attrs.title.replace(/"/g, '\\"')}"` : "";
}

function inline(nodes: Node[], inTable = false): string {
  // A space moved out of an emphasis (`wrap`) next to a space already there would double it.
  return nodes
    .map((node): [string, boolean] => [inlineNode(node, inTable), typeof node !== "string"])
    .reduce((out, [piece, element]) => out + (element && /\s$/.test(out) ? piece.replace(/^ +/, "") : piece), "");
}

function inlineNode(node: Node, inTable: boolean): string {
  if (typeof node === "string") {
    const text = escapeText(node);
    return inTable ? text.replace(/\|/g, "\\|").replace(/\n/g, " ") : text;
  }
  const inner = () => inline(node.children, inTable);
  switch (node.tag) {
    case "strong":
    case "b":
      return wrap("**", inner());
    case "em":
    case "i":
      return wrap("*", inner());
    case "s":
    case "del":
      return wrap("~~", inner());
    case "code": {
      const code = textOf(node);
      const fence = "`".repeat(Math.max(0, ...[...code.matchAll(/`+/g)].map((m) => m[0].length)) + 1);
      return code.startsWith("`") || code.endsWith("`") ? `${fence} ${code} ${fence}` : `${fence}${code}${fence}`;
    }
    case "a":
      return node.attrs.href ? `[${inner()}](${destination(node.attrs.href)}${title(node.attrs)})` : inner();
    case "img":
      return node.attrs.src ? `![${escapeText(node.attrs.alt ?? "").replace(/\n/g, " ")}](${destination(node.attrs.src)}${title(node.attrs)})` : "";
    case "br":
      return inTable ? " " : "\\\n";
    default:
      return inner();
  }
}

/** Emphasis markers hug the text: spaces at either end move outside them, as Markdown wants. */
function wrap(marker: string, text: string): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  return match[2] ? `${match[1]}${marker}${match[2]}${marker}${match[3]}` : text;
}

/** The blocks of a container: runs of inline content become paragraphs. */
function blocks(nodes: Node[]): string[] {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const text = escapeLineStarts(inline(run).replace(/^[ \t\n]+|[ \t\n]+$/g, ""));
    if (text) out.push(text);
    run = [];
  };
  for (const node of nodes) {
    if (!isBlock(node)) {
      run.push(node);
      continue;
    }
    flush();
    const block = renderBlock(node as Element);
    if (block) out.push(block);
  }
  flush();
  return out;
}

function renderBlock(element: Element): string {
  switch (element.tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Math.min(4, Math.max(2, Number(element.tag[1])));
      return `${"#".repeat(level)} ${inline(element.children).replace(/\s*\n\s*/g, " ").trim()}`;
    }
    case "p":
      return escapeLineStarts(inline(element.children).replace(/^[ \t\n]+|[ \t\n]+$/g, ""));
    case "hr":
      return "---";
    case "blockquote": {
      const lines = blocks(element.children).join("\n\n").split("\n");
      // The red box keeps its marker on a line of its own (GitHub's alert syntax, read back by markDangerBoxes).
      if (/(^|\s)danger(\s|$)/.test(element.attrs.class ?? "")) lines.unshift("[!DANGER]");
      return lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
    }
    case "pre": {
      const code = textOf(element).replace(/\n$/, "");
      const fence = "`".repeat(Math.max(3, ...[...code.matchAll(/`{3,}/g)].map((m) => m[0].length + 1)));
      const codeElement = element.children.find((child): child is Element => typeof child !== "string" && child.tag === "code");
      const language = /language-([\w-]+)/.exec(codeElement?.attrs.class ?? "")?.[1] ?? "";
      return `${fence}${language}\n${code}\n${fence}`;
    }
    case "ul":
    case "ol":
      return list(element);
    case "table":
      return table(element);
    default:
      return blocks(element.children).join("\n\n");
  }
}

function list(element: Element): string {
  const items = element.children.filter((child): child is Element => typeof child !== "string" && child.tag === "li");
  // A loose list (blank lines between items) puts each item's text in a paragraph.
  const loose = items.some((item) => item.children.some((child) => typeof child !== "string" && child.tag === "p"));
  const start = Number(element.attrs.start) || 1;
  return items
    .map((item, index) => {
      const marker = element.tag === "ol" ? `${start + index}. ` : "- ";
      const body = blocks(item.children).join(loose ? "\n\n" : "\n");
      const indent = " ".repeat(marker.length);
      return marker + body.split("\n").map((line, n) => (n === 0 || !line ? line : indent + line)).join("\n");
    })
    .join(loose ? "\n\n" : "\n");
}

function table(element: Element): string {
  const rows: Element[] = [];
  const collect = (node: Element) => {
    for (const child of node.children) {
      if (typeof child === "string") continue;
      if (child.tag === "tr") rows.push(child);
      else if (child.tag === "thead" || child.tag === "tbody" || child.tag === "tfoot") collect(child);
    }
  };
  collect(element);
  if (rows.length === 0) return "";
  const cells = rows.map((row) => row.children.filter((cell): cell is Element => typeof cell !== "string" && (cell.tag === "th" || cell.tag === "td")));
  const width = Math.max(...cells.map((row) => row.length));
  const line = (row: Element[]) =>
    `| ${Array.from({ length: width }, (_, i) => (row[i] ? inline(row[i].children, true).trim() : "")).join(" | ")} |`;
  const align = (cell: Element | undefined) => {
    const value = cell?.attrs.align ?? /text-align:\s*(\w+)/.exec(cell?.attrs.style ?? "")?.[1];
    return value === "center" ? ":---:" : value === "right" ? "---:" : value === "left" ? ":---" : "---";
  };
  const [head, ...body] = cells;
  return [line(head), `| ${Array.from({ length: width }, (_, i) => align(head[i])).join(" | ")} |`, ...body.map(line)].join("\n");
}

/** Markdown for the editor from stored HTML. */
export function htmlToMarkdown(html: string): string {
  return blocks(parse(html.replace(/\r\n?/g, "\n")).children)
    .join("\n\n")
    .replace(/ /g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
