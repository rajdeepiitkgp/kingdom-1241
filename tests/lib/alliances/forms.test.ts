import { describe, expect, it } from "vitest";
import { ALLIANCE_COLORS, nextAllianceColor, parseAllianceForm, parsePower, statsChanged } from "@/lib/alliances/forms";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("the owner's alliance form", () => {
  it("reads power as the game shows it, or short", () => {
    expect(parsePower("26,062,114,452")).toEqual({ ok: true, value: 26062114452 });
    expect(parsePower("26.062.114.452")).toEqual({ ok: true, value: 26062114452 });
    expect(parsePower(" 26.06B ")).toEqual({ ok: true, value: 26060000000 });
    expect(parsePower("950m")).toEqual({ ok: true, value: 950000000 });
    expect(parsePower("")).toEqual({ ok: true, value: null });
    for (const bad of ["lots", "26.06T", "-5", "1e9"]) expect(parsePower(bad).ok, bad).toBe(false);
  });

  it("checks every field and strips brackets from the tag", () => {
    expect(parseAllianceForm(form({ tag: "[NAM]", name: "NewAgeMonarchs", color: "#E2559B", power: "26.06B", leader: "", members: "96" }))).toEqual({
      ok: true,
      value: { tag: "NAM", name: "NewAgeMonarchs", color: "#e2559b", power: 26060000000, leader: null, members: 96 },
    });
    const bad = parseAllianceForm(form({ tag: "TOO LONG TAG", name: "", color: "red", power: "x", members: "500" }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["color", "members", "name", "power", "tag"]);
  });

  it("refuses the battle alliances, which are never listed on Home", () => {
    const parsed = parseAllianceForm(form({ tag: "[KvK]", name: "Kingdom1241", color: "#3b7fe4" }));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors.tag).toContain("battle alliances");
  });

  it("knows when the numbers were typed by hand", () => {
    const before = { power: 1, leader: "A", members: 2 };
    expect(statsChanged(before, { ...before })).toBe(false);
    expect(statsChanged(before, { ...before, leader: "B" })).toBe(true);
  });

  it("gives a new alliance the first colour nobody uses", () => {
    expect(nextAllianceColor([])).toBe(ALLIANCE_COLORS[0]);
    expect(nextAllianceColor([ALLIANCE_COLORS[0].toUpperCase(), ALLIANCE_COLORS[1]])).toBe(ALLIANCE_COLORS[2]);
    expect(ALLIANCE_COLORS).toContain(nextAllianceColor(ALLIANCE_COLORS));
  });
});
