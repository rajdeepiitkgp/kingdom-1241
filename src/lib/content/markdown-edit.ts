// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * What the editor's formatting buttons do to the text (pure): each takes the
 * text and the selection and returns the stretch to replace, its new text and
 * the selection afterwards, so the component can apply it as one typed edit
 * (the browser's undo then takes it back in one step).
 */

export interface Selection {
  start: number;
  end: number;
}

export interface TextEdit {
  /** The stretch of the old text that is replaced … */
  from: number;
  to: number;
  /** … by this. */
  insert: string;
  /** The selection afterwards, in the new text. */
  select: Selection;
}

/** Bold, italics, strikethrough, code: wraps the selection (or a placeholder) in a marker; a wrapped selection is unwrapped. */
export function toggleWrap(text: string, selection: Selection, marker: string, placeholder: string): TextEdit {
  const { start, end } = selection;
  const before = text.slice(Math.max(0, start - marker.length), start);
  const after = text.slice(end, end + marker.length);
  if (before === marker && after === marker) {
    return { from: start - marker.length, to: end + marker.length, insert: text.slice(start, end), select: { start: start - marker.length, end: end - marker.length } };
  }
  // Spaces at the ends of the selection stay outside the markers (Markdown needs the marker next to the text).
  const selected = text.slice(start, end);
  const lead = /^\s*/.exec(selected)![0];
  const trail = selected.trim() ? /\s*$/.exec(selected)![0] : "";
  const inner = selected.trim() || placeholder;
  const insert = `${lead}${marker}${inner}${marker}${trail}`;
  const innerStart = start + lead.length + marker.length;
  return { from: start, to: end, insert, select: { start: innerStart, end: innerStart + inner.length } };
}

/** The whole lines the selection touches. */
function lineRange(text: string, selection: Selection): Selection {
  const start = text.lastIndexOf("\n", selection.start - 1) + 1;
  const endBreak = text.indexOf("\n", selection.end > selection.start && text[selection.end - 1] === "\n" ? selection.end - 1 : selection.end);
  return { start, end: endBreak === -1 ? text.length : endBreak };
}

const LINE_MARKS = /^(\s*)(#{1,6} |> |[-*+] |\d+[.)] )/;

/**
 * Heading, list, numbered list, quote: puts `prefix` in front of every line
 * the selection touches (numbers count up from 1); when every line already
 * has it, takes it off. Another line mark is replaced, so a list item can
 * become a heading in one tap.
 */
export function toggleLinePrefix(text: string, selection: Selection, prefix: "## " | "- " | "1. " | "> "): TextEdit {
  const range = lineRange(text, selection);
  const lines = text.slice(range.start, range.end).split("\n");
  const has = (line: string) => (prefix === "1. " ? /^\s*\d+[.)] /.test(line) : line.trimStart().startsWith(prefix));
  const remove = lines.filter((line) => line.trim()).every(has);
  let number = 0;
  const next = lines.map((line) => {
    if (!line.trim()) return line;
    const bare = line.replace(LINE_MARKS, "$1");
    if (remove) return bare;
    const indent = /^\s*/.exec(bare)![0];
    number += 1;
    return `${indent}${prefix === "1. " ? `${number}. ` : prefix}${bare.slice(indent.length)}`;
  });
  const insert = next.join("\n");
  return { from: range.start, to: range.end, insert, select: { start: range.start, end: range.start + insert.length } };
}

/** A link: the selection becomes its text (or a placeholder), and the address is selected to be typed or pasted. */
export function insertLink(text: string, selection: Selection, placeholder: string): TextEdit {
  const selected = text.slice(selection.start, selection.end).trim();
  const isUrl = /^https?:\/\/\S+$/.test(selected);
  const label = isUrl ? placeholder : selected || placeholder;
  const url = isUrl ? selected : "https://";
  const insert = `[${label}](${url})`;
  // A selected address is kept and its text selected instead.
  const selectStart = isUrl ? selection.start + 1 : selection.start + label.length + 3;
  const selectLength = isUrl ? label.length : url.length;
  return { from: selection.start, to: selection.end, insert, select: { start: selectStart, end: selectStart + selectLength } };
}

/**
 * A block (a table, an image) on lines of its own at the cursor, with a blank
 * line before and after it so Markdown reads it as a block; `select` is the
 * part of the block to select afterwards (offsets into `block`).
 */
export function insertBlock(text: string, selection: Selection, block: string, select: Selection = { start: block.length, end: block.length }): TextEdit {
  const before = text.slice(0, selection.start);
  const after = text.slice(selection.end);
  const lead = before === "" ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after === "" ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const insert = `${lead}${block}${trail}`;
  const offset = selection.start + lead.length;
  return { from: selection.start, to: selection.end, insert, select: { start: offset + select.start, end: offset + select.end } };
}

/** The table a tap on the table button inserts: three columns and two rows to fill in. */
export const TABLE_TEMPLATE = "| Column | Column | Column |\n| --- | --- | --- |\n| Text | Text | Text |\n| Text | Text | Text |";

/** An image line with its description selected, to be typed right away. */
export function imageMarkdown(url: string, description = "Describe the image"): { block: string; select: Selection } {
  return { block: `![${description}](${url})`, select: { start: 2, end: 2 + description.length } };
}
