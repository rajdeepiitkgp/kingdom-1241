import { describe, expect, it } from "vitest";
import type { KvkChecklistRule } from "@/lib/data/types";
import { checklistProgress, itemsByPhase, parseTicked, rulesInSection, toggleTicked } from "@/lib/kvk/checklist";

describe("itemsByPhase", () => {
  it("groups in battle order, keeps the council's order within a phase and leaves out empty phases", () => {
    const items = [
      { id: "a", phase: "after" as const },
      { id: "b", phase: "before" as const },
      { id: "c", phase: "after" as const },
      { id: "d", phase: "day" as const },
    ];
    expect(itemsByPhase(items).map((g) => [g.phase, g.items.map((i) => i.id)])).toEqual([
      ["before", ["b"]],
      ["day", ["d"]],
      ["after", ["a", "c"]],
    ]);
    expect(itemsByPhase([])).toEqual([]);
  });
});

describe("rulesInSection", () => {
  it("keeps one section's lines in order", () => {
    const rule = (id: string, section: KvkChecklistRule["section"]): KvkChecklistRule => ({ id, planId: "p", section, kind: "do", text: { en: id }, sortOrder: 0, published: true });
    const rules = [rule("1", "general"), rule("2", "commander"), rule("3", "commander")];
    expect(rulesInSection(rules, "commander").map((r) => r.id)).toEqual(["2", "3"]);
    expect(rulesInSection(rules, "general").map((r) => r.id)).toEqual(["1"]);
  });
});

describe("parseTicked", () => {
  it("reads a JSON list of ids and ignores anything else", () => {
    expect(parseTicked('["a","b"]')).toEqual(["a", "b"]);
    expect(parseTicked('["a",2,null]')).toEqual(["a"]);
    expect(parseTicked('{"a":true}')).toEqual([]);
    expect(parseTicked("not json")).toEqual([]);
    expect(parseTicked("")).toEqual([]);
    expect(parseTicked(null)).toEqual([]);
  });
});

describe("checklistProgress / toggleTicked", () => {
  const ids = ["a", "b", "c"];

  it("counts only ticks of current items", () => {
    expect(checklistProgress(ids, new Set(["a", "gone"]))).toEqual({ done: 1, total: 3 });
    expect(checklistProgress([], new Set())).toEqual({ done: 0, total: 0 });
  });

  it("ticks and unticks one item, dropping ids the council removed", () => {
    expect(toggleTicked(new Set(["gone", "a"]), "c", ids)).toEqual(["a", "c"]);
    expect(toggleTicked(new Set(["a", "c"]), "a", ids)).toEqual(["c"]);
  });
});
