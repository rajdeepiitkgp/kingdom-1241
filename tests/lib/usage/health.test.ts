// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DAY, HOUR, MINUTE } from "@/lib/time";
import {
  ageLevel,
  ago,
  formatBytes,
  FREE_PLAN,
  parseJobRun,
  parseUsageSnapshot,
  shareLevel,
  supabaseRef,
  type UsageInput,
  usageReport,
  verdict,
  verdictLine,
} from "@/lib/usage/health";

const NOW = Date.parse("2026-10-28T20:30:00.000Z");
const before = (ms: number) => new Date(NOW - ms).toISOString();
const MB = 1024 * 1024;

// The shape public.usage_snapshot() answers with (bigint sums come back as numbers or strings).
const SNAPSHOT = {
  databases_bytes: 24 * MB,
  wal_bytes: "33554432",
  connections: 12,
  max_connections: 60,
  cache_reads: 250000,
  cache_hit: 0.9991,
  tables: [
    { name: "audit_log", bytes: 1.5 * MB, rows: 3400 },
    { name: "ui_strings", bytes: 1.2 * MB, rows: 1040 },
    { name: "kvk_retro_responses", bytes: 0.3 * MB, rows: 80 },
  ],
  storage_bytes: 0,
  storage_objects: 0,
  cron: [
    { name: "cron-run-history-cleanup", schedule: "17 3 * * *", active: true, status: "succeeded", started_at: before(17 * HOUR), message: "1 row" },
    { name: "rally-sync-close-idle-rooms", schedule: "*/5 * * * *", active: true, status: "succeeded", started_at: before(3 * MINUTE), message: "DELETE 0" },
  ],
};

const healthy = (): UsageInput => ({
  snapshot: parseUsageSnapshot(SNAPSHOT),
  rally: { browsers: 14, rooms: 2 },
  alliances: { at: before(14 * HOUR), ok: true },
  giftCodes: { at: before(7 * MINUTE), okAt: before(7 * MINUTE), listed: 0 },
  backup: { at: before(2 * DAY) },
  prune: { at: before(15 * HOUR) },
  translation: { configured: true, paused: false, label: "Claude Haiku 5.5" },
  supabaseRef: "abcdefghijklmnopqrst",
});

const levels = (input: UsageInput) => {
  const report = usageReport(input, NOW);
  return Object.fromEntries([...report.database, ...report.jobs].map((check) => [check.id, check.level]));
};
const all = (input: UsageInput) => {
  const report = usageReport(input, NOW);
  return [...report.database, ...report.jobs];
};

describe("reading the snapshot", () => {
  it("reads the database's answer, numbers as text included", () => {
    const snapshot = parseUsageSnapshot(SNAPSHOT);
    expect(snapshot).toMatchObject({ databasesBytes: 24 * MB, walBytes: 32 * MB, connections: 12, maxConnections: 60, cacheHit: 0.9991, storageBytes: 0 });
    expect(snapshot?.tables.map((t) => t.name)).toEqual(["audit_log", "ui_strings", "kvk_retro_responses"]);
    expect(snapshot?.cron?.[1]).toMatchObject({ name: "rally-sync-close-idle-rooms", status: "succeeded", active: true });
  });

  it("keeps what it can't read as unknown, and pg_cron's absence as null", () => {
    expect(parseUsageSnapshot(null)).toBeNull();
    expect(parseUsageSnapshot({ databases_bytes: "lots", cron: null, tables: [{ bytes: 1 }, "x"] })).toMatchObject({ databasesBytes: null, walBytes: null, tables: [], cron: null, cacheReads: 0 });
  });

  it("reads a job's note and the project ref", () => {
    expect(parseJobRun({ at: "2026-10-26T04:17:40Z", rows: 900 })).toEqual({ at: "2026-10-26T04:17:40.000Z" });
    expect(parseJobRun({ at: "never" })).toBeNull();
    expect(supabaseRef("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(supabaseRef("http://127.0.0.1:54321")).toBeNull();
  });
});

describe("the rules", () => {
  it("watch from 70 % of a limit and act from 90 %", () => {
    expect([0.69, 0.7, 0.89, 0.9].map(shareLevel)).toEqual(["ok", "watch", "watch", "act"]);
  });

  it("judge a job by the age of its last run, and a job never seen as worth watching", () => {
    expect(ageLevel(before(HOUR), NOW, 2 * HOUR, 6 * HOUR)).toBe("ok");
    expect(ageLevel(before(3 * HOUR), NOW, 2 * HOUR, 6 * HOUR)).toBe("watch");
    expect(ageLevel(before(7 * HOUR), NOW, 2 * HOUR, 6 * HOUR)).toBe("act");
    expect(ageLevel(null, NOW, 2 * HOUR, 6 * HOUR)).toBe("watch");
  });

  it("say sizes and ages the way the dashboards do", () => {
    expect([0, 512, 24 * MB, 24.6 * MB, FREE_PLAN.databaseBytes, FREE_PLAN.diskBytes, 1.25 * FREE_PLAN.diskBytes].map(formatBytes)).toEqual(["0 kB", "1 kB", "24 MB", "24.6 MB", "500 MB", "2 GB", "2.5 GB"]);
    expect([30 * 1000, 7 * MINUTE, 14 * HOUR, 3 * DAY].map((ms) => ago(before(ms), NOW))).toEqual(["just now", "7 min ago", "14 h ago", "3 days ago"]);
  });
});

describe("the report", () => {
  it("is all fine on a healthy day", () => {
    const result = verdict(all(healthy()));
    expect(result.level).toBe("ok");
    expect(verdictLine(result)).toBe("All fine");
    expect(all(healthy()).find((c) => c.id === "database")?.value).toBe("24 MB of 500 MB (5 %)");
  });

  it("asks for action when the database nears its quota or the disk fills", () => {
    const input = healthy();
    input.snapshot = parseUsageSnapshot({ ...SNAPSHOT, databases_bytes: 460 * MB, wal_bytes: 1400 * MB });
    expect(levels(input)).toMatchObject({ database: "act", disk: "act" });
    expect(verdictLine(verdict(all(input)))).toBe("2 need action");
  });

  it("leaves the disk out when the log can't be read, and judges speed only with enough reads", () => {
    const input = healthy();
    input.snapshot = parseUsageSnapshot({ ...SNAPSHOT, wal_bytes: null, cache_reads: 500, cache_hit: 0.5 });
    expect(levels(input).disk).toBeUndefined();
    expect(levels(input).cache).toBe("ok");
    input.snapshot = parseUsageSnapshot({ ...SNAPSHOT, cache_hit: 0.97 });
    expect(levels(input).cache).toBe("watch");
  });

  it("flags a failed or stalled database job, and pg_cron being off", () => {
    const input = healthy();
    input.snapshot = parseUsageSnapshot({ ...SNAPSHOT, cron: [{ ...SNAPSHOT.cron[1], status: "failed", message: "permission denied" }] });
    expect(levels(input).cron).toBe("act");
    expect(all(input).find((c) => c.id === "cron")?.detail).toContain("permission denied");
    input.snapshot = parseUsageSnapshot({ ...SNAPSHOT, cron: [{ ...SNAPSHOT.cron[1], started_at: before(40 * MINUTE) }] });
    expect(levels(input).cron).toBe("watch");
    input.snapshot = parseUsageSnapshot({ ...SNAPSHOT, cron: null });
    expect(levels(input).cron).toBe("watch");
  });

  it("notices a job that stopped running", () => {
    const input = healthy();
    input.backup = { at: before(10 * DAY) };
    input.prune = { at: before(3 * DAY) };
    input.giftCodes = { at: before(5 * MINUTE), okAt: before(3 * HOUR), listed: 0 };
    input.alliances = { at: before(2 * HOUR), ok: false };
    expect(levels(input)).toMatchObject({ backup: "watch", prune: "act", "gift-codes": "watch", alliances: "watch" });
    input.backup = { at: before(20 * DAY) };
    expect(levels(input).backup).toBe("act");
    input.backup = null;
    expect(levels(input).backup).toBe("watch");
  });

  it("counts Rally Sync browsers against the budget, and a paused translation as worth watching", () => {
    const input = healthy();
    input.rally = { browsers: 170, rooms: 9 };
    input.translation = { configured: true, paused: true, label: "Claude Haiku 5.5" };
    expect(levels(input)).toMatchObject({ realtime: "act", translation: "watch" });
  });

  it("says when the database couldn't be asked at all", () => {
    const input = healthy();
    input.snapshot = null;
    const report = usageReport(input, NOW);
    expect(report.database.map((c) => [c.id, c.level])).toEqual([["database", "unknown"]]);
    expect(report.jobs.find((c) => c.id === "cron")).toBeUndefined();
    expect(verdictLine(verdict([...report.database, ...report.jobs]))).toBe("1 to watch");
  });

  it("names the times of the Maintenance schedules it describes", () => {
    const workflow = readFileSync(".github/workflows/maintenance.yml", "utf8");
    for (const cron of ["17 4 * * 1", "41 5 * * *", "7 6 * * *"]) expect(workflow).toContain(`cron: "${cron}"`);
  });
});
