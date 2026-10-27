import { describe, expect, it } from "vitest";
import { clipText, FIELD, isGovernorId, isHoneypotFilled, NO_ALLIANCE, normalizeGovernorId, parseRetroForm } from "@/lib/retro/form";
import { defaultConfig } from "@/lib/retro/questions";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const TAGS = ["NAM", "ULU"];
const valid = {
  [FIELD.governorId]: "12 345 678",
  [FIELD.gameName]: "Rudy",
  [FIELD.alliance]: "NAM",
  [FIELD.locale]: "de",
  [FIELD.rating("overall")]: "4",
  [FIELD.rating("planning")]: "0",
  [FIELD.rating("coordination")]: "5",
  [FIELD.rating("formations")]: "3",
  [FIELD.text("went_well")]: "Rallies were on time.\r\nGood calls.",
};

describe("governor ids", () => {
  it("normalises separators and checks the shape", () => {
    expect(normalizeGovernorId(" 12 345-678 ")).toBe("12345678");
    expect(isGovernorId("12345678")).toBe(true);
    expect(isGovernorId("123")).toBe(false);
    expect(isGovernorId("12a45678")).toBe(false);
    expect(isGovernorId("12345678901234567")).toBe(false);
  });
});

describe("parseRetroForm", () => {
  const config = defaultConfig();

  it("accepts a complete answer, keeps 0 as a rating and normalises line ends", () => {
    const result = parseRetroForm(form(valid), config, TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.governorId).toBe("12345678");
    expect(result.value.ratings).toEqual({ overall: 4, planning: 0, coordination: 5, formations: 3 });
    expect(result.value.texts.went_well).toBe("Rallies were on time.\nGood calls.");
    expect(result.value.texts.suggestions).toBe("");
    expect(result.value.allianceTag).toBe("NAM");
    expect(result.value.locale).toBe("de");
  });

  it("requires the shown-and-required ratings, not the optional ones", () => {
    const optional = defaultConfig();
    optional.ratings.formations.required = false;
    optional.ratings.timing = { shown: true, required: false };
    const fd = form({ ...valid });
    fd.delete(FIELD.rating("formations"));
    fd.delete(FIELD.rating("overall"));
    const result = parseRetroForm(fd, optional, TAGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({ [FIELD.rating("overall")]: "required" });
  });

  it("flags bad ratings, long texts and unknown alliances", () => {
    const result = parseRetroForm(
      form({ ...valid, [FIELD.rating("overall")]: "7", [FIELD.text("suggestions")]: "x".repeat(501), [FIELD.alliance]: "XYZ" }),
      config,
      TAGS,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[FIELD.rating("overall")]).toBe("invalid");
    expect(result.errors[FIELD.text("suggestions")]).toBe("tooLong");
    expect(result.errors[FIELD.alliance]).toBe("invalid");
  });

  it("needs name and alliance only when the id was not verified", () => {
    const fd = form({ ...valid });
    fd.delete(FIELD.gameName);
    fd.delete(FIELD.alliance);
    const unverified = parseRetroForm(fd, config, TAGS);
    expect(unverified.ok).toBe(false);
    if (!unverified.ok) expect(Object.keys(unverified.errors).sort()).toEqual([FIELD.alliance, FIELD.gameName]);

    const verified = parseRetroForm(fd, config, TAGS, { verified: { name: "Verified Rudy", allianceTag: "ULU" } });
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.gameName).toBe("Verified Rudy");
      expect(verified.value.allianceTag).toBe("ULU");
    }
    // An alliance MightPulse knows but the site doesn't: the player's own pick counts, else "other".
    const foreign = parseRetroForm(fd, config, TAGS, { verified: { name: "X", allianceTag: "ZZZ" } });
    expect(foreign.ok && foreign.value.allianceTag).toBeNull();
    fd.set(FIELD.alliance, "NAM");
    const picked = parseRetroForm(fd, config, TAGS, { verified: { name: "X", allianceTag: "ZZZ" } });
    expect(picked.ok && picked.value.allianceTag).toBe("NAM");
  });

  it("treats the no-alliance option and the honeypot as expected", () => {
    const result = parseRetroForm(form({ ...valid, [FIELD.alliance]: NO_ALLIANCE, [FIELD.locale]: "<script>" }), config, TAGS);
    expect(result.ok && result.value.allianceTag).toBeNull();
    expect(result.ok && result.value.locale).toBe("en");
    expect(isHoneypotFilled(form({ [FIELD.honeypot]: "http://spam" }))).toBe(true);
    expect(isHoneypotFilled(form(valid))).toBe(false);
  });

  it("requires a shown-and-required text", () => {
    const strict = defaultConfig();
    strict.texts.suggestions.required = true;
    const result = parseRetroForm(form(valid), strict, TAGS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[FIELD.text("suggestions")]).toBe("required");
  });
});

describe("clipText", () => {
  it("never cuts an emoji in half", () => {
    const clipped = clipText("ab🔥🔥", 3);
    expect(clipped).toBe("ab🔥");
    expect(clipped.isWellFormed()).toBe(true);
    expect("ab🔥🔥".slice(0, 3).isWellFormed()).toBe(false);
  });

  it("leaves short texts alone", () => {
    expect(clipText("short", 10)).toBe("short");
  });
});
