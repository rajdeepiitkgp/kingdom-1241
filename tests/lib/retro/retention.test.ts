import { describe, expect, it } from "vitest";
import { dueRetrospectives } from "@/lib/retro/prune";
import { isDue, isOpenNow, pruneAt } from "@/lib/retro/retention";

describe("retention", () => {
  const battle = { battleAt: "2026-10-01T14:00:00Z", createdAt: "2026-09-20T00:00:00Z", retentionDays: 30 };

  it("counts from the battle, else from the creation of the form", () => {
    expect(pruneAt(battle).toISOString()).toBe("2026-10-31T14:00:00.000Z");
    expect(pruneAt({ ...battle, battleAt: null }).toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(isDue(battle, new Date("2026-10-31T13:59:00Z"))).toBe(false);
    expect(isDue(battle, new Date("2026-10-31T14:00:00Z"))).toBe(true);
  });

  it("knows when a form accepts answers", () => {
    const now = new Date("2026-10-25T12:00:00Z");
    expect(isOpenNow({ open: false, closesAt: null }, now)).toBe(false);
    expect(isOpenNow({ open: true, closesAt: null }, now)).toBe(true);
    expect(isOpenNow({ open: true, closesAt: "2026-10-26T00:00:00Z" }, now)).toBe(true);
    expect(isOpenNow({ open: true, closesAt: "2026-10-25T12:00:00Z" }, now)).toBe(false);
    expect(isOpenNow({ open: true, closesAt: "not a date" }, now)).toBe(true);
  });

  it("selects the retrospectives whose data is due, and skips orphans", () => {
    const retros = [
      { id: "a", plan_id: "p1", open: true, created_at: "2026-09-20T00:00:00Z", retention_days: 30 },
      { id: "b", plan_id: "p2", open: false, created_at: "2026-10-20T00:00:00Z", retention_days: 30 },
      { id: "c", plan_id: "gone", open: false, created_at: "2026-01-01T00:00:00Z", retention_days: 7 },
    ];
    const plans = [
      { id: "p1", slug: "old", battle_at: "2026-10-01T14:00:00Z" },
      { id: "p2", slug: "fresh", battle_at: "2026-10-24T14:00:00Z" },
    ];
    const due = dueRetrospectives(retros, plans, new Date("2026-11-01T00:00:00Z"));
    expect(due.map((d) => d.plan.slug)).toEqual(["old"]);
    expect(due[0].pruneAt.toISOString()).toBe("2026-10-31T14:00:00.000Z");
  });
});
