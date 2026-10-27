import { describe, expect, it } from "vitest";
import {
  moveInList,
  nextFreeLabel,
  parseCoordinatorForm,
  parseFormationForm,
  parseLeaderBriefForm,
  parseLeaderRuleForm,
  parsePlanForm,
  parseRallyLeaderForm,
  parseRuleForm,
} from "@/lib/admin/kvk-forms";

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parsePlanForm", () => {
  const valid = {
    title: "Castle Battle — 1 Nov",
    eventType: "castle_battle",
    password: "secret",
    battleAt: "2026-11-01T14:00",
    minHeroStars: "4",
    minSkillLevel: "5",
    introSource: "Hi all!",
    active: "on",
  };

  it("accepts a complete plan and derives the slug", () => {
    const result = parsePlanForm(form(valid));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("castle-battle-1-nov");
    expect(result.value.battleAt).toBe("2026-11-01T14:00:00.000Z");
    expect(result.value.active).toBe(true);
    expect(result.value.published).toBe(false);
    expect(result.value.opponent).toBeNull();
  });

  it("refuses a changed battle time in the past, but keeps an unchanged one", () => {
    const now = new Date("2026-10-20T10:00:00.000Z"); // the valid sample (1 Nov) lies ahead of it
    const past = { ...valid, battleAt: "2026-10-01T14:00" };
    const rejected = parsePlanForm(form(past), { now });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.errors.battleAt).toMatch(/past/);
    // Editing an old plan without touching its time (stored in Postgres format) stays valid.
    expect(parsePlanForm(form(past), { now, previousBattleAt: "2026-10-01T14:00:00+00:00" }).ok).toBe(true);
    expect(parsePlanForm(form(valid), { now }).ok).toBe(true);
    expect(parsePlanForm(form({ ...valid, battleAt: "" }), { now }).ok).toBe(true);
  });

  it("takes an optional end time that must come after the start", () => {
    const ok = parsePlanForm(form({ ...valid, battleEndAt: "2026-11-01T17:00" }));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.battleEndAt).toBe("2026-11-01T17:00:00.000Z");
    const none = parsePlanForm(form(valid));
    if (none.ok) expect(none.value.battleEndAt).toBeNull();
    for (const bad of [{ battleEndAt: "2026-11-01T14:00" }, { battleEndAt: "2026-11-01T09:00" }, { battleEndAt: "soon" }, { battleAt: "", battleEndAt: "2026-11-01T17:00" }]) {
      const result = parsePlanForm(form({ ...valid, ...bad }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(Object.keys(result.errors)).toEqual(["battleEndAt"]);
    }
    // Only the start is checked against the clock; the end of a battle that is already over may be entered afterwards.
    const later = new Date("2026-12-01T00:00:00.000Z");
    expect(parsePlanForm(form({ ...valid, battleEndAt: "2026-11-01T17:00" }), { now: later, previousBattleAt: "2026-11-01T14:00:00+00:00" }).ok).toBe(true);
  });

  it("reports every invalid field at once", () => {
    const result = parsePlanForm(form({ ...valid, title: "", password: "abc", battleAt: "soon", minHeroStars: "7", introSource: "x".repeat(20_001) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["battleAt", "introSource", "minHeroStars", "password", "slug", "title"]);
  });
});

describe("parseRuleForm", () => {
  it("needs text and defaults the kind", () => {
    expect(parseRuleForm(form({ text: "" })).ok).toBe(false);
    const result = parseRuleForm(form({ text: "No buffs", kind: "dont", published: "on" }));
    expect(result).toEqual({ ok: true, value: { kind: "dont", text: "No buffs", published: true } });
  });

  it("never takes an order from the form (rows are moved with the arrows)", () => {
    const result = parseRuleForm(form({ text: "x", sortOrder: "3" }));
    expect(result.ok && "sortOrder" in result.value).toBe(false);
  });
});

describe("parseCoordinatorForm", () => {
  it("checks the alliance against the kingdom's list", () => {
    const tags = ["NAM", "ULU"];
    expect(parseCoordinatorForm(form({ name: "Cleo", allianceTag: "XYZ" }), tags).ok).toBe(false);
    const result = parseCoordinatorForm(form({ name: "Cleo", team: "tmp", allianceTag: "ULU", note: "English" }), tags);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toMatchObject({ team: "tmp", allianceTag: "ULU", note: "English" });
  });
});

describe("parseFormationForm", () => {
  const heroes = ["amane", "chenko", "hilde"];
  const valid = { label: "a", side: "attack", role: "any", hero1: "amane", infantry: "50", cavalry: "15", archers: "35" };

  it("accepts a valid formation and upper-cases the label", () => {
    const result = parseFormationForm(form(valid), heroes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toBe("A");
    expect(result.value.heroes).toEqual(["amane", null, null]);
  });

  it("rejects ratios that do not add up, unknown heroes and duplicates", () => {
    const bad = parseFormationForm(form({ ...valid, archers: "40" }), heroes);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.ratio).toContain("105");

    const unknown = parseFormationForm(form({ ...valid, hero2: "nobody" }), heroes);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors.hero2).toBeDefined();

    const twice = parseFormationForm(form({ ...valid, hero2: "amane" }), heroes);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.errors.heroes).toBeDefined();

    const badLabel = parseFormationForm(form({ ...valid, label: "M" }), heroes);
    expect(badLabel.ok).toBe(false);
  });
});

describe("nextFreeLabel", () => {
  it("finds the first unused preset letter", () => {
    expect(nextFreeLabel([])).toBe("A");
    expect(nextFreeLabel(["A", "b", "C"])).toBe("D");
    expect(nextFreeLabel([..."ABCDEFGHIJKL"])).toBeNull();
  });
});

describe("moveInList", () => {
  const ids = ["a", "b", "c"];

  it("swaps a row with its neighbour", () => {
    expect(moveInList(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInList(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("does nothing at the ends or for an unknown row", () => {
    expect(moveInList(ids, "a", "up")).toBeNull();
    expect(moveInList(ids, "c", "down")).toBeNull();
    expect(moveInList(ids, "zz", "up")).toBeNull();
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("parseLeaderBriefForm", () => {
  it("accepts the leaders' own password and instructions", () => {
    const result = parseLeaderBriefForm(form({ password: " rally-1241 ", introSource: "Start on the call.", published: "on" }), "1241");
    expect(result).toEqual({ ok: true, value: { password: "rally-1241", introSource: "Start on the call.", published: true } });
  });

  it("refuses a short password and the battle plan's password", () => {
    const short = parseLeaderBriefForm(form({ password: "abc" }), "1241");
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.errors.password).toMatch(/4 characters/);
    const same = parseLeaderBriefForm(form({ password: "1241" }), " 1241 ");
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.errors.password).toMatch(/different password/);
  });

  it("is unpublished without the checkbox", () => {
    const result = parseLeaderBriefForm(form({ password: "leaders" }));
    expect(result.ok && result.value.published).toBe(false);
  });
});

describe("parseRallyLeaderForm", () => {
  const heroes = ["amane", "chenko", "hilde"];
  const tags = ["NAM", "ULU"];
  const valid = {
    target: "Castle — first wave",
    side: "attack",
    team: "tmp",
    name: "Leader",
    allianceTag: "NAM",
    position: "Left side of the castle",
    startAt: "2026-11-01T14:05",
    petsOffsetMinutes: "120",
    hero1: "amane",
    hero2: "",
    hero3: "",
    infantry: "50",
    cavalry: "15",
    archers: "35",
    note: "Wave 1",
    published: "on",
  };

  it("accepts a complete rally", () => {
    const result = parseRallyLeaderForm(form(valid), heroes, tags);
    expect(result).toEqual({
      ok: true,
      value: {
        target: "Castle — first wave",
        side: "attack",
        team: "tmp",
        name: "Leader",
        allianceTag: "NAM",
        position: "Left side of the castle",
        startAt: "2026-11-01T14:05:00.000Z",
        petsOffsetMinutes: 120,
        heroes: ["amane", null, null],
        infantry: 50,
        cavalry: 15,
        archers: 35,
        note: "Wave 1",
        published: true,
      },
    });
  });

  it("needs a rally and a name, a known alliance and hero, and a ratio of 100", () => {
    const result = parseRallyLeaderForm(form({ ...valid, target: "", name: "", allianceTag: "XXX", hero2: "nobody", archers: "30" }), heroes, tags);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["allianceTag", "hero2", "name", "ratio", "target"]);
  });

  it("refuses the same hero twice and falls back to attack for an unknown side", () => {
    const twice = parseRallyLeaderForm(form({ ...valid, hero2: "amane" }), heroes, tags);
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.errors.heroes).toBeDefined();
    const side = parseRallyLeaderForm(form({ ...valid, side: "sideways" }), heroes, tags);
    expect(side.ok && side.value.side).toBe("attack");
  });
});

describe("parseRallyLeaderForm — times and team", () => {
  const base = { target: "Castle", name: "Leader", infantry: "50", cavalry: "0", archers: "50" };
  it("leaves start time, pets and position empty when not given, and defaults to the [KvK] team", () => {
    const result = parseRallyLeaderForm(form(base), [], []);
    expect(result.ok && result.value).toMatchObject({ team: "kvk", startAt: null, petsOffsetMinutes: null, position: "" });
  });
  it("keeps pets at the battle start (0) apart from no pets", () => {
    const result = parseRallyLeaderForm(form({ ...base, petsOffsetMinutes: "0" }), [], []);
    expect(result.ok && result.value.petsOffsetMinutes).toBe(0);
  });
  it("refuses a malformed start time and pets beyond a day", () => {
    const result = parseRallyLeaderForm(form({ ...base, startAt: "tomorrow", petsOffsetMinutes: "1500" }), [], []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["petsOffsetMinutes", "startAt"]);
  });
  it("accepts a start time in the past (an old plan stays editable)", () => {
    expect(parseRallyLeaderForm(form({ ...base, startAt: "2020-01-01T10:00" }), [], []).ok).toBe(true);
  });
});

describe("parseLeaderRuleForm", () => {
  it("adds the audience to a rule line, every leader by default", () => {
    expect(parseLeaderRuleForm(form({ kind: "do", text: "Note your march time", audience: "garrison" }))).toEqual({
      ok: true,
      value: { kind: "do", text: "Note your march time", published: false, audience: "garrison" },
    });
    const fallback = parseLeaderRuleForm(form({ kind: "do", text: "x", audience: "everyone" }));
    expect(fallback.ok && fallback.value.audience).toBe("all");
    expect(parseLeaderRuleForm(form({ kind: "do", text: "" })).ok).toBe(false);
  });
});

describe("parseRallyLeaderForm — pets inside the battle", () => {
  const base = { target: "Castle", name: "Leader", infantry: "50", cavalry: "0", archers: "50" };
  it("refuses a pets start whose 2-hour boost would outlast the battle", () => {
    const late = parseRallyLeaderForm(form({ ...base, petsOffsetMinutes: "330" }), [], [], { latestPetsOffset: 300 });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.errors.petsOffsetMinutes).toMatch(/5 h/);
    expect(parseRallyLeaderForm(form({ ...base, petsOffsetMinutes: "300" }), [], [], { latestPetsOffset: 300 }).ok).toBe(true);
  });
});
