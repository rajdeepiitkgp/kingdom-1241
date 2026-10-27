import { describe, expect, it } from "vitest";
import { formatGameName, gameNameTaken, parseGameName, parseProfileForm, splitAllianceTag } from "@/lib/admin/profile";

const TAGS = ["NAM", "ULU", "KvK"];

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseGameName", () => {
  it("trims and collapses spaces", () => {
    expect(parseGameName("  Boo  Boo Bonita ")).toEqual({ ok: true, value: "Boo Boo Bonita" });
  });
  it("rejects too short, too long and control characters", () => {
    expect(parseGameName("R").ok).toBe(false);
    expect(parseGameName("x".repeat(41)).ok).toBe(false);
    expect(parseGameName("Rudy\u0007").ok).toBe(false);
    expect(parseGameName(undefined).ok).toBe(false);
  });
});

describe("splitAllianceTag", () => {
  it("takes a known tag off the front of the name, whatever its case", () => {
    expect(splitAllianceTag("[ULU] Rudy", TAGS)).toEqual({ name: "Rudy", tag: "ULU" });
    expect(splitAllianceTag("[ kvk ]Cleo", TAGS)).toEqual({ name: "Cleo", tag: "KvK" });
  });
  it("leaves unknown tags and plain names alone", () => {
    expect(splitAllianceTag("[XYZ] Rudy", TAGS)).toEqual({ name: "[XYZ] Rudy", tag: null });
    expect(splitAllianceTag("Rudy", TAGS)).toEqual({ name: "Rudy", tag: null });
  });
});

describe("parseProfileForm", () => {
  it("uses the dropdown for the alliance", () => {
    expect(parseProfileForm(form({ gameName: "Rudy", allianceTag: "ULU" }), TAGS)).toEqual({ ok: true, value: { gameName: "Rudy", allianceTag: "ULU" } });
    expect(parseProfileForm(form({ gameName: "Rudy", allianceTag: "" }), TAGS)).toEqual({ ok: true, value: { gameName: "Rudy", allianceTag: null } });
    expect(parseProfileForm(form({ gameName: "Rudy", allianceTag: "XYZ" }), TAGS)).toEqual({ ok: true, value: { gameName: "Rudy", allianceTag: null } });
  });
  it("lets a typed [TAG] win over the dropdown and strips it from the name", () => {
    expect(parseProfileForm(form({ gameName: "[ULU] Rudy", allianceTag: "NAM" }), TAGS)).toEqual({ ok: true, value: { gameName: "Rudy", allianceTag: "ULU" } });
  });
  it("validates the name after the tag is removed", () => {
    const result = parseProfileForm(form({ gameName: "[ULU] R" }), TAGS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.gameName).toContain("at least 2");
  });
});

describe("formatGameName", () => {
  it("shows the tag in front like the game does", () => {
    expect(formatGameName("Rudy", "ULU")).toBe("[ULU] Rudy");
    expect(formatGameName("Rudy", null)).toBe("Rudy");
    expect(formatGameName(null, "ULU")).toBeNull();
  });
});

describe("gameNameTaken", () => {
  const profiles = [
    { id: "me", game_name: "Rudy" },
    { id: "other", game_name: "Iron  Fist" },
    { id: "blank", game_name: null },
  ];

  it("refuses a name another account uses, ignoring case and spacing", () => {
    expect(gameNameTaken("iron fist", "me", profiles)).toBe(true);
    expect(gameNameTaken("IRON FIST ", "me", profiles)).toBe(true);
  });

  it("allows the account's own name and names nobody uses", () => {
    expect(gameNameTaken("rudy", "me", profiles)).toBe(false);
    expect(gameNameTaken("Nova", "me", profiles)).toBe(false);
  });
});
