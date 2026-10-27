import { describe, expect, it } from "vitest";
import {
  boolField,
  htmlToEditableText,
  intField,
  introSourceUnchanged,
  isUuid,
  localeField,
  localizedUpdate,
  oneOfField,
  shownIntroSource,
  slugify,
  toUtcInputValue,
  utcDateTimeField,
  uuidField,
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

describe("uuidField / localeField", () => {
  const fd = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  };

  it("accepts only a well-formed UUID, so a tampered hidden field never reaches the database", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(isUuid(id)).toBe(true);
    expect(isUuid(id.toUpperCase())).toBe(true);
    expect(uuidField(fd({ id: ` ${id} ` }), "id")).toBe(id);
    for (const bad of ["", "new", "3f2504e04f8911d39a0c0305e82c3301", "3f2504e0-4f89-11d3-9a0c-0305e82c330", "------------------------------------", "3f2504e0-4f89-11d3-9a0c-0305e82c33zz"]) {
      expect(isUuid(bad), bad).toBe(false);
      expect(uuidField(fd({ id: bad }), "id"), bad).toBeNull();
    }
    expect(isUuid(42)).toBe(false);
  });

  it("falls back to English for anything that is not a locale code", () => {
    expect(localeField(fd({ locale: "de" }))).toBe("de");
    expect(localeField(fd({ locale: "pt-BR" }))).toBe("pt-BR");
    expect(localeField(fd({ locale: "../../etc" }))).toBe("en");
    expect(localeField(fd({}))).toBe("en");
    expect(localeField(fd({ lang: "ar" }), "lang")).toBe("ar");
  });
});

describe("intro sources", () => {
  it("shows the stored Markdown, else text derived from the HTML", () => {
    expect(shownIntroSource({ en: "**Hold** the line" }, { en: "<p><strong>Hold</strong> the line</p>" })).toBe("**Hold** the line");
    expect(shownIntroSource(null, { en: "<p><strong>Hold</strong> the line</p>" })).toBe("**Hold** the line");
    expect(shownIntroSource({ en: "  " }, { en: "<p>Seed</p>" })).toBe("Seed");
    expect(shownIntroSource(null, null)).toBe("");
  });

  it("treats the text the editor showed as unchanged, whatever line endings the browser sends", () => {
    expect(introSourceUnchanged("Line one\r\nLine two\r\n", "Line one\nLine two")).toBe(true);
    expect(introSourceUnchanged("Line one\nLine 2", "Line one\nLine two")).toBe(false);
  });
});
