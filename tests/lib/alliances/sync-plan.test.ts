// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { MightPulseAlliance } from "@/lib/alliances/mightpulse-data";
import {
  battleHold,
  battleRows,
  DAILY_SYNC_UTC,
  heldForReview,
  homeRanking,
  isBattleAlliance,
  lookupTag,
  NO_SYNC_YET,
  parseAllianceSyncState,
  planAllianceSync,
  planSync,
  rowByTag,
  type StoredAlliance,
  syncState,
} from "@/lib/alliances/sync-plan";

const mp = (aid: number, tag: string, name: string, power: number, rank: number): MightPulseAlliance => ({ aid, tag, name, power, leader: `${tag} lead`, members: 90, rank });
const BOARD = [mp(1, "NAM", "NewAgeMonarchs", 26e9, 1), mp(2, "NEW", "Renamed", 24e9, 2), mp(3, "EOL", "EliteOutlaws", 20e9, 3)];

describe("planning an alliance sync", () => {
  const linked: StoredAlliance = { id: "a", tag: "OLD", name: "Old name", aid: 2 };
  const unlinked: StoredAlliance = { id: "b", tag: "EOL", name: "EliteOutlaws", aid: null };

  it("asks MightPulse for the ranking's tag of a linked alliance (it may have a new one)", () => {
    expect(lookupTag(linked, BOARD)).toBe("NEW");
    expect(lookupTag(unlinked, BOARD)).toBe("EOL");
    expect(lookupTag({ id: "c", tag: "GONE", name: "x", aid: 9 }, BOARD)).toBe("GONE");
  });

  it("follows a rename by the alliance id and links an unlinked alliance by its tag", () => {
    const [renamed, link] = planAllianceSync([linked, unlinked], BOARD, new Map());
    expect(renamed).toMatchObject({ status: "synced", linked: false, renamedFrom: "[OLD] Old name", values: { aid: 2, tag: "NEW", name: "Renamed" } });
    expect(link).toMatchObject({ status: "synced", linked: true, values: { aid: 3, tag: "EOL" } });
  });

  it("links by the exact tag: [NAM] and [Nam] are two alliances of 1241", () => {
    const board = [mp(6, "Nam", "NAMacademy", 2.8e9, 6), mp(1, "NAM", "NewAgeMonarchs", 26e9, 1), mp(7, "Old", "OldSchool", 2e9, 7)];
    expect(rowByTag(board, "NAM")?.name).toBe("NewAgeMonarchs");
    expect(rowByTag(board, "Nam")?.name).toBe("NAMacademy");
    // Another case is another alliance, never a near match.
    expect(rowByTag(board, "OLD")).toBeNull();
    expect(rowByTag(board, "nam")).toBeNull();
    const [nam] = planAllianceSync([{ id: "n", tag: "NAM", name: "NewAgeMonarchs", aid: null }], board, new Map());
    expect(nam).toMatchObject({ status: "synced", linked: true, values: { aid: 1 } });
  });

  it("prefers the fresher one-alliance answer, but only for the same alliance", () => {
    const fresh = { ...BOARD[0], power: 27e9, rank: null };
    const [nam] = planAllianceSync([{ id: "n", tag: "NAM", name: "NewAgeMonarchs", aid: 1 }], BOARD, new Map([["n", fresh]]));
    expect(nam).toMatchObject({ status: "synced", renamedFrom: null, values: { power: 27e9, rank: 1 } });
    // The tag now belongs to another alliance: the ranking's row (by id) wins.
    const [other] = planAllianceSync([{ id: "n", tag: "NAM", name: "NewAgeMonarchs", aid: 1 }], BOARD, new Map([["n", mp(99, "NAM", "Usurpers", 1e9, 40)]]));
    expect(other).toMatchObject({ status: "synced", values: { aid: 1, power: 26e9 } });
  });

  it("reports an alliance MightPulse doesn't have, and never takes a stranger's tag answer for it", () => {
    const gone: StoredAlliance = { id: "g", tag: "GONE", name: "Gone", aid: 9 };
    expect(planAllianceSync([gone], BOARD, new Map([["g", mp(10, "GONE", "Someone else", 1e9, 50)]]))).toEqual([{ id: "g", tag: "GONE", status: "missing" }]);
    expect(planAllianceSync([{ id: "h", tag: "XYZ", name: "By hand", aid: null }], [], new Map())).toEqual([{ id: "h", tag: "XYZ", status: "missing" }]);
  });

  it("keeps the last sync tolerantly", () => {
    expect(parseAllianceSyncState(null)).toEqual(NO_SYNC_YET);
    const state = { at: "2026-10-28T06:07:00.000Z", ok: true, problem: null, by: "daily", synced: 2, missing: ["X", 3], board: BOARD, boardAt: "nope" };
    expect(parseAllianceSyncState(state)).toEqual({ ...state, missing: ["X"], boardAt: null, battle: [], battleDay: false });
  });

  it("names the time of the Maintenance workflow's daily run", () => {
    const [hour, minute] = DAILY_SYNC_UTC.split(":").map(Number);
    expect(readFileSync(".github/workflows/maintenance.yml", "utf8")).toContain(`cron: "${minute} ${hour} * * *"`);
  });
});

describe("the battle alliances", () => {
  const home = [
    { id: "nam", tag: "NAM", name: "NewAgeMonarchs", aid: 1, power: 26e9 },
    { id: "ulu", tag: "ULU", name: "TURAN", aid: 2, power: 24e9 },
  ];
  const kvk = (power: number, members: number) => ({ aid: 900, tag: "KvK", name: "Kingdom1241", power, leader: "x", members, rank: null });

  it("looks them up by tag until seen, then by id", () => {
    expect(battleRows([])).toEqual([
      { id: "battle:KvK", tag: "KvK", name: "KvK", aid: null },
      { id: "battle:TMP", tag: "TMP", name: "TMP", aid: null },
    ]);
    expect(battleRows([kvk(1, 1)]).map((row) => row.aid)).toEqual([900, null]);
    expect(isBattleAlliance({ aid: 900, tag: "Renamed" }, [kvk(1, 1)])).toBe(true);
    expect(isBattleAlliance({ aid: 5, tag: "TMP" }, [])).toBe(true);
    expect(isBattleAlliance({ aid: 5, tag: "kvk" }, [])).toBe(false);
  });

  it("ranks the home alliances without them, so NewAgeMonarchs stays first on battle day", () => {
    const board = [mp(900, "KvK", "Kingdom1241", 90e9, 1), mp(901, "TMP", "Counter", 60e9, 2), mp(1, "NAM", "NewAgeMonarchs", 5e9, 3), mp(2, "ULU", "TURAN", 4e9, 4)];
    expect(homeRanking(board, []).map((row) => [row.tag, row.rank])).toEqual([
      ["NAM", 1],
      ["ULU", 2],
    ]);
  });

  it("keeps the home alliances' numbers on a battle day, but still follows a new tag", () => {
    const details = new Map([
      ["nam", mp(1, "NAM", "NewAgeMonarchs", 3e9, 3)],
      ["ulu", mp(2, "UL2", "TURAN", 2e9, 4)],
      ["battle:KvK", kvk(70e9, 98)],
    ]);
    const plan = planSync({ rows: home, battle: [], board: null, details, battleDay: true });
    expect(plan.battle).toEqual([kvk(70e9, 98)]);
    expect(plan.writes.map((write) => [write.values.tag, write.numbers])).toEqual([
      ["NAM", false],
      ["UL2", false],
    ]);
    // Any other day the numbers follow, whatever the battle alliances hold.
    expect(planSync({ rows: home, battle: [], board: null, details, battleDay: false }).writes.every((write) => write.numbers)).toBe(true);
  });

  it("holds on every second Saturday, on a moved battle's date, and until noon the day after", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(battleHold(at("2026-10-24T06:07:00Z"), null)).toBe(true); // castle battle
    expect(battleHold(at("2026-11-07T06:07:00Z"), null)).toBe(true); // KvK
    expect(battleHold(at("2026-11-21T00:00:00Z"), null)).toBe(true); // castle battle
    expect(battleHold(at("2026-11-08T11:59:00Z"), null)).toBe(true); // the morning after
    expect(battleHold(at("2026-11-08T12:00:00Z"), null)).toBe(false);
    expect(battleHold(at("2026-10-31T06:07:00Z"), null)).toBe(false); // a Saturday without a battle
    expect(battleHold(at("2026-11-06T23:59:00Z"), null)).toBe(false); // the evening before
    expect(battleHold(at("2026-11-10T06:07:00Z"), "2026-11-10T12:00:00.000Z")).toBe(true); // a battle moved to a Tuesday
  });

  it("holds an alliance outside the list for review when it climbs into the top six", () => {
    const ranking = [mp(1, "NAM", "a", 9, 1), mp(5, "WST", "Westeros", 8, 2), mp(6, "LOW", "b", 1, 7)];
    expect(heldForReview(ranking, new Set([1])).map((row) => row.tag)).toEqual(["WST"]);
  });

  it("stores what the sync saw, and keeps the last ranking and battle state when MightPulse is down", () => {
    const previous = { ...NO_SYNC_YET, board: BOARD, boardAt: "2026-10-27T00:50:00.000Z" };
    const down = planSync({ rows: home, battle: [], board: null, details: new Map(), battleDay: false });
    const state = syncState(down, { synced: 0, missing: [] }, previous, null, "2026-10-28T06:07:00.000Z", "daily");
    expect(state).toMatchObject({ ok: false, problem: "MightPulse didn't answer (or refused the key)", board: BOARD, boardAt: previous.boardAt });
  });
});
