// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { parseAllianceInfo, parseBoard, parseStoredBoard } from "@/lib/alliances/mightpulse-data";

// Shapes as MightPulse answered on 28 Oct 2026 (values made up).
const BOARD = {
  ok: true,
  kid: 1241,
  board: {
    key: "alliance_power",
    captured_at: 1793148633.327,
    kind: "alliance",
    rows: [
      { rank: 1, aid: 125000066, abbr: "NAM", name: "NewAgeMonarchs", score: 26062114452, kid: 1241, leader_name: "Lead1", member_count: 96, flag_url: "/x.png" },
      { rank: 2, aid: 125000077, abbr: "uLu", name: "TURAN", score: 23953880847, kid: 1241, leader_name: "", member_count: 88 },
      { rank: 3, abbr: "BAD", name: "No id" },
    ],
  },
};

describe("MightPulse alliance answers", () => {
  it("reads the power ranking, keeping the tag as the game writes it", () => {
    const board = parseBoard(BOARD);
    expect(board?.capturedAt).toBe(new Date(1793148633 * 1000).toISOString());
    expect(board?.rows).toEqual([
      { aid: 125000066, tag: "NAM", name: "NewAgeMonarchs", power: 26062114452, leader: "Lead1", members: 96, rank: 1 },
      { aid: 125000077, tag: "uLu", name: "TURAN", power: 23953880847, leader: null, members: 88, rank: 2 },
    ]);
  });

  it("also finds the ranking in the boards list, and refuses other shapes", () => {
    expect(parseBoard({ boards: [BOARD.board] })?.rows).toHaveLength(2);
    for (const body of [null, "x", {}, { board: { rows: "no" } }]) expect(parseBoard(body)).toBeNull();
  });

  it("reads one alliance's info", () => {
    const json = { ok: true, aid: 125000066, tag: "NAM", alliance: { aid: 125000066, name: "NewAgeMonarchs", abbr: "NAM", kid: 1241, power: 26106469608, count: 96, leader_name: "Lead1", power_rank: 1 } };
    expect(parseAllianceInfo(json)).toEqual({ aid: 125000066, tag: "NAM", name: "NewAgeMonarchs", power: 26106469608, leader: "Lead1", members: 96, rank: 1 });
    expect(parseAllianceInfo({ ok: false, error: "not found" })).toBeNull();
  });

  it("reads the ranking back from app_config", () => {
    const rows = parseBoard(BOARD)!.rows;
    expect(parseStoredBoard(JSON.parse(JSON.stringify(rows)))).toEqual(rows);
    expect(parseStoredBoard("nonsense")).toEqual([]);
  });
});
