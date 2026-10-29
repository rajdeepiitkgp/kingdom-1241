// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { imageMarkdown, insertBlock, insertLink, TABLE_TEMPLATE, type TextEdit, toggleDangerBox, toggleLinePrefix, toggleWrap } from "@/lib/content/markdown-edit";

const applied = (text: string, edit: TextEdit) => text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
const selected = (text: string, edit: TextEdit) => applied(text, edit).slice(edit.select.start, edit.select.end);

describe("toggleWrap", () => {
  it("wraps the selection and keeps it selected", () => {
    const text = "Rally at noon";
    const edit = toggleWrap(text, { start: 9, end: 13 }, "**", "bold text");
    expect(applied(text, edit)).toBe("Rally at **noon**");
    expect(selected(text, edit)).toBe("noon");
  });

  it("unwraps a wrapped selection", () => {
    const text = "Rally at **noon**";
    const edit = toggleWrap(text, { start: 11, end: 15 }, "**", "bold text");
    expect(applied(text, edit)).toBe("Rally at noon");
    expect(selected(text, edit)).toBe("noon");
  });

  it("inserts a selected placeholder without a selection, and keeps spaces outside", () => {
    const empty = toggleWrap("Hi ", { start: 3, end: 3 }, "*", "italic text");
    expect(applied("Hi ", empty)).toBe("Hi *italic text*");
    expect(selected("Hi ", empty)).toBe("italic text");
    const spaced = toggleWrap("a word b", { start: 1, end: 7 }, "**", "x");
    expect(applied("a word b", spaced)).toBe("a **word** b");
  });
});

describe("toggleDangerBox", () => {
  const warn = "Don't do this.";
  it("puts the marker above the touched lines and quotes them, lists and all", () => {
    const text = "Intro\nNever hit first\n- or you burn\nOutro";
    const edit = toggleDangerBox(text, { start: 8, end: 25 }, warn);
    expect(applied(text, edit)).toBe("Intro\n> [!DANGER]\n> Never hit first\n> - or you burn\nOutro");
  });

  it("gives an empty line the placeholder, selected", () => {
    const text = "a\n\nb";
    const edit = toggleDangerBox(text, { start: 2, end: 2 }, warn);
    expect(applied(text, edit)).toBe(`a\n> [!DANGER]\n> ${warn}\nb`);
    expect(selected(text, edit)).toBe(warn);
  });

  it("takes the whole box off from its marker or any line in it, and leaves a gold quote above alone", () => {
    const boxed = "> gold\n\n> [!DANGER]\n> Never hit first\n> or you burn\nafter";
    const fromBody = toggleDangerBox(boxed, { start: boxed.indexOf("or you"), end: boxed.indexOf("or you") }, warn);
    expect(applied(boxed, fromBody)).toBe("> gold\n\nNever hit first\nor you burn\nafter");
    const fromMarker = toggleDangerBox(boxed, { start: boxed.indexOf("[!"), end: boxed.indexOf("[!") }, warn);
    expect(applied(boxed, fromMarker)).toBe("> gold\n\nNever hit first\nor you burn\nafter");
  });

  it("turns a gold quote red without quoting it twice", () => {
    expect(applied("> hold", toggleDangerBox("> hold", { start: 3, end: 3 }, warn))).toBe("> [!DANGER]\n> hold");
  });
});

describe("toggleLinePrefix", () => {
  it("turns the touched lines into a list and back", () => {
    const text = "Intro\nfirst\nsecond\nOutro";
    const edit = toggleLinePrefix(text, { start: 8, end: 15 }, "- ");
    expect(applied(text, edit)).toBe("Intro\n- first\n- second\nOutro");
    const back = toggleLinePrefix(applied(text, edit), { start: 7, end: 20 }, "- ");
    expect(applied(applied(text, edit), back)).toBe(text);
  });

  it("numbers lines from 1 and swaps one mark for another", () => {
    const text = "- one\n- two\n\n- three";
    const edit = toggleLinePrefix(text, { start: 0, end: text.length }, "1. ");
    expect(applied(text, edit)).toBe("1. one\n2. two\n\n3. three");
    expect(applied("- item", toggleLinePrefix("- item", { start: 3, end: 3 }, "## "))).toBe("## item");
  });

  it("quotes the current line when nothing is selected", () => {
    const text = "a\nquote me\nb";
    expect(applied(text, toggleLinePrefix(text, { start: 4, end: 4 }, "> "))).toBe("a\n> quote me\nb");
  });
});

describe("insertLink", () => {
  it("links the selected words and selects the address to fill in", () => {
    const text = "Read the guide";
    const edit = insertLink(text, { start: 9, end: 14 }, "link text");
    expect(applied(text, edit)).toBe("Read the [guide](https://)");
    expect(selected(text, edit)).toBe("https://");
  });

  it("keeps a selected address and selects the text to type", () => {
    const text = "See https://example.com now";
    const edit = insertLink(text, { start: 4, end: 23 }, "link text");
    expect(applied(text, edit)).toBe("See [link text](https://example.com) now");
    expect(selected(text, edit)).toBe("link text");
  });
});

describe("insertBlock", () => {
  it("puts a block on lines of its own", () => {
    const text = "Before.After.";
    const edit = insertBlock(text, { start: 7, end: 7 }, TABLE_TEMPLATE, { start: 2, end: 8 });
    expect(applied(text, edit)).toBe(`Before.\n\n${TABLE_TEMPLATE}\n\nAfter.`);
    expect(selected(text, edit)).toBe("Column");
  });

  it("adds no extra blank lines where they already are", () => {
    const text = "Before.\n\nAfter.";
    const { block, select } = imageMarkdown("https://x/img.webp");
    const edit = insertBlock(text, { start: 9, end: 9 }, block, select);
    expect(applied(text, edit)).toBe("Before.\n\n![Describe the image](https://x/img.webp)\n\nAfter.");
    expect(selected(text, edit)).toBe("Describe the image");
    expect(applied("", insertBlock("", { start: 0, end: 0 }, "x"))).toBe("x\n");
  });
});
