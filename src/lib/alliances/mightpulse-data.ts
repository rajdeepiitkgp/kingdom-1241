// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.

/**
 * MightPulse's alliance answers (pure, unit-tested; the calls are in sync.ts).
 * GET /v1/kingdoms/{kid}/ranks?board=alliance_power is the kingdom's power
 * ranking (up to 100 rows, a snapshot MightPulse takes about once a day): the
 * game's alliance id `aid`, tag `abbr`, `name`, power `score`, `leader_name`,
 * `member_count`, `rank`. GET /v1/alliances/{kid}/{tag}?include=info is one
 * alliance by its tag (case-sensitive there), at most an hour old: the same
 * fields under `alliance`, with `power`, `count` and `power_rank`. A row with
 * an unexpected shape is dropped, never guessed.
 */

export interface MightPulseAlliance {
  /** The game's alliance id: stays the same when the tag or the name changes. */
  aid: number;
  tag: string;
  name: string;
  power: number | null;
  leader: string | null;
  members: number | null;
  rank: number | null;
}

export interface AllianceBoard {
  rows: MightPulseAlliance[];
  /** When MightPulse took the ranking (ISO). */
  capturedAt: string | null;
}

const record = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const whole = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null);

type Fields = { power: string; members: string; rank: string };
const BOARD_FIELDS: Fields = { power: "score", members: "member_count", rank: "rank" };
const INFO_FIELDS: Fields = { power: "power", members: "count", rank: "power_rank" };
const OWN_FIELDS: Fields = { power: "power", members: "members", rank: "rank" };

function alliance(value: unknown, fields: Fields, tagField = "abbr"): MightPulseAlliance | null {
  const row = record(value);
  if (!row) return null;
  const aid = whole(row.aid);
  const tag = text(row[tagField], 8);
  const name = text(row.name, 60);
  if (!aid || !tag || !name) return null;
  return { aid, tag, name, power: whole(row[fields.power]), leader: text(row.leader_name ?? row.leader, 40), members: whole(row[fields.members]), rank: whole(row[fields.rank]) };
}

const rowsOf = (value: unknown, fields: Fields, tagField?: string) =>
  Array.isArray(value) ? value.map((row) => alliance(row, fields, tagField)).filter((row): row is MightPulseAlliance => row !== null) : [];

export function parseBoard(json: unknown): AllianceBoard | null {
  const body = record(json);
  const board = record(body?.board) ?? record(Array.isArray(body?.boards) ? body.boards[0] : null);
  if (!board || !Array.isArray(board.rows)) return null;
  const captured = whole(board.captured_at);
  return { rows: rowsOf(board.rows, BOARD_FIELDS), capturedAt: captured ? new Date(captured * 1000).toISOString() : null };
}

export function parseAllianceInfo(json: unknown): MightPulseAlliance | null {
  return alliance(record(json)?.alliance, INFO_FIELDS);
}

/** The ranking as stored in app_config (our own field names). */
export function parseStoredBoard(value: unknown): MightPulseAlliance[] {
  return rowsOf(value, OWN_FIELDS, "tag");
}
