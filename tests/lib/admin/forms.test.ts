import { describe, expect, it } from "vitest";
import {
  boolField,
  htmlToEditableText,
  intField,
  localizedUpdate,
  oneOfField,
  slugify,
  toUtcInputValue,
  utcDateTimeField,
} from "@/lib/admin/forms";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("field parsers", () => {
  it("parses whole numbers inside a range", () => {
    expect(intField(form({ n: "42" }), "n", 0, 100)).toBe(42);
    expect(intField(form({ n: "101" }), "n", 0, 100)).toBeNull();
    expect(intField(form({ n: "4.5" }), "n", 0, 100)).toBeNull();
    expect(intField(form({}), "n", 0, 100)).toBeNull();
  });

  it("reads checkboxes and enumerations", () => {
    expect(boolField(form({ c: "on" }), "c")).toBe(true);
    expect(boolField(form({}), "c")).toBe(false);
    expect(oneOfField(form({ s: "attack" }), "s", ["attack", "defense"] as const, "defense")).toBe("attack");
    expect(oneOfField(form({ s: "bogus" }), "s", ["attack", "defense"] as const, "defense")).toBe("defense");
  });

  it("treats datetime-local values as UTC and round-trips them", () => {
    expect(utcDateTimeField(form({ d: "2026-10-25T14:00" }), "d")).toBe("2026-10-25T14:00:00.000Z");
    expect(utcDateTimeField(form({ d: "" }), "d")).toBeNull();
    expect(utcDateTimeField(form({ d: "yesterday" }), "d")).toBeUndefined();
    expect(toUtcInputValue("2026-10-25T14:00:00.000Z")).toBe("2026-10-25T14:00");
    expect(toUtcInputValue(null)).toBe("");
  });

  it("slugifies titles", () => {
    expect(slugify("Castle Battle — 25 Oct")).toBe("castle-battle-25-oct");
    expect(slugify("  Ünïcode & stuff!! ")).toBe("unicode-stuff");
  });
});

describe("localizedUpdate", () => {
  it("keeps translations while English is unchanged and drops them otherwise", () => {
    const existing = { en: "Hello", de: "Hallo" };
    expect(localizedUpdate(existing, "Hello")).toBe(existing);
    expect(localizedUpdate(existing, "Hi")).toEqual({ en: "Hi" });
    expect(localizedUpdate(null, "Hi")).toEqual({ en: "Hi" });
  });
});

describe("htmlToEditableText", () => {
  it("turns simple HTML back into Markdown-ish text", () => {
    const html =
      "<p>Hi all! 👋 <strong>Castle Battle tomorrow</strong></p><ul><li>No buffs</li><li>Listen to <em>coordinators</em></li></ul><blockquote><p>Council: edit me.</p></blockquote>";
    expect(htmlToEditableText(html)).toBe(
      "Hi all! 👋 **Castle Battle tomorrow**\n\n- No buffs\n- Listen to *coordinators*\n\n> Council: edit me.",
    );
  });
});
