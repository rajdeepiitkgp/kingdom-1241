// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_BROWSER_MINUTES,
  BROWSER_BUDGET,
  type Capacity,
  CAPACITY_BOUNDS,
  CAPACITY_MODES,
  capacityFixes,
  capacityTotals,
  DEFAULT_CAPACITY,
  parseCapacity,
  parseCapacityForm,
  REALTIME_CONNECTIONS,
  sameCapacity,
} from "@/lib/rally-sync/capacity";

const changed = (changes: Partial<Record<keyof Capacity, Partial<Capacity[keyof Capacity]>>>): Capacity => ({
  rally: { ...DEFAULT_CAPACITY.rally, ...changes.rally },
  garrison: { ...DEFAULT_CAPACITY.garrison, ...changes.garrison },
  counter: { ...DEFAULT_CAPACITY.counter, ...changes.counter },
});

const form = (capacity: Capacity) => {
  const data = new FormData();
  for (const mode of CAPACITY_MODES) for (const field of ["rooms", "leaders", "browsers"] as const) data.set(`${mode}-${field}`, String(capacity[mode][field]));
  return data;
};

describe("rally sync capacity", () => {
  it("defaults to a battle day on castle and turrets that just fits the shared budget", () => {
    expect(capacityTotals(DEFAULT_CAPACITY)).toEqual({ perMode: { rally: 60, garrison: 110, counter: 10 }, total: 180, over: 0 });
    expect(BROWSER_BUDGET).toBeLessThan(REALTIME_CONNECTIONS);
    for (const mode of CAPACITY_MODES) {
      for (const field of ["rooms", "leaders", "browsers"] as const) {
        const [min, max] = CAPACITY_BOUNDS[mode][field];
        expect(DEFAULT_CAPACITY[mode][field]).toBeGreaterThanOrEqual(min);
        expect(DEFAULT_CAPACITY[mode][field]).toBeLessThanOrEqual(max);
      }
    }
    expect(DEFAULT_CAPACITY.garrison.leaders).toBe(0);
  });

  it("reads a stored value tolerantly, inside the bounds", () => {
    expect(parseCapacity(null)).toEqual(DEFAULT_CAPACITY);
    expect(parseCapacity("nonsense")).toEqual(DEFAULT_CAPACITY);
    const stored = parseCapacity({ rally: { rooms: 99, leaders: "7", browsers: 6 }, garrison: { rooms: 0, leaders: 4 }, counter: { browsers: 2.5 } });
    expect(stored.rally).toEqual({ rooms: 8, leaders: 10, browsers: 6 });
    expect(stored.garrison).toEqual({ rooms: 1, leaders: 0, browsers: 22 });
    expect(stored.counter).toEqual(DEFAULT_CAPACITY.counter);
  });

  it("adds up what the three kinds could hold and says how far over the budget that is", () => {
    const more = changed({ garrison: { browsers: 30 } });
    expect(capacityTotals(more)).toEqual({ perMode: { rally: 60, garrison: 150, counter: 10 }, total: 220, over: 40 });
  });

  it("offers every single number that brings the total back within, lowered as little as needed, the smallest cut first", () => {
    expect(capacityFixes(DEFAULT_CAPACITY)).toEqual([]);
    const base = changed({ garrison: { browsers: 30 } });
    const fixes = capacityFixes(base);
    // Garrison may use 180 − 70 = 110: 22 browsers in 5 rooms, or 3 rooms of 30. Rally may use 20: 4 browsers is below its minimum, 1 room of 12 isn't.
    expect(fixes).toEqual([
      { mode: "garrison", field: "browsers", from: 30, to: 22 },
      { mode: "garrison", field: "rooms", from: 5, to: 3 },
      { mode: "rally", field: "rooms", from: 5, to: 1 },
    ]);
    for (const fix of fixes) {
      const fixed = structuredClone(base);
      fixed[fix.mode][fix.field] = fix.to;
      expect(capacityTotals(fixed).over, `${fix.mode} ${fix.field}`).toBe(0);
    }
  });

  it("accepts the settings form only with every number in range and the total within the budget", () => {
    expect(parseCapacityForm(form(DEFAULT_CAPACITY))).toEqual({ ok: true, value: DEFAULT_CAPACITY });
    // Garrison leaders can't be set: they stay 0 whatever is sent.
    const sent = form(DEFAULT_CAPACITY);
    sent.set("garrison-leaders", "9");
    expect(parseCapacityForm(sent)).toEqual({ ok: true, value: DEFAULT_CAPACITY });

    const outOfRange = form(DEFAULT_CAPACITY);
    outOfRange.set("counter-rooms", "3");
    outOfRange.set("rally-browsers", "abc");
    expect(parseCapacityForm(outOfRange)).toEqual({ ok: false, errors: { "counter-rooms": "1 to 2.", "rally-browsers": "5 to 30." } });

    const over = parseCapacityForm(form(changed({ garrison: { browsers: 30 } })));
    expect(over.ok).toBe(false);
    expect(!over.ok && over.message).toContain("220 browsers, 40 more than the 180 allowed");
  });

  it("compares limits by value", () => {
    expect(sameCapacity(DEFAULT_CAPACITY, changed({}))).toBe(true);
    expect(sameCapacity(DEFAULT_CAPACITY, changed({ counter: { rooms: 2 } }))).toBe(false);
  });

  it("are the same numbers the database enforces (migration 0016)", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0016_owner_settings.sql"), "utf8");
    const literal = (name: string) => JSON.parse(new RegExp(`${name} constant jsonb := '([^']+)'`).exec(sql)?.[1] ?? "null");
    expect(literal("defaults")).toEqual(DEFAULT_CAPACITY);
    expect(literal("bounds")).toEqual(JSON.parse(JSON.stringify(CAPACITY_BOUNDS)));
    expect(sql.match(new RegExp(`interval '${ACTIVE_BROWSER_MINUTES} minutes'`, "g"))).toHaveLength(2);
    expect(sql).toContain(`>= ${BROWSER_BUDGET} then`);
  });
});
