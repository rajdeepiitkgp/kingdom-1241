// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { AllianceSyncState } from "@/lib/alliances/sync-plan";
import type { GiftCodeSyncState } from "@/lib/gift-codes/sync-plan";
import { BROWSER_BUDGET } from "@/lib/rally-sync/capacity";
import { DAY, HOUR, MINUTE } from "@/lib/time";

/**
 * The owner's Usage tab (pure, unit-tested; usage-data.ts gathers the
 * numbers): every measure the site can take of itself, each judged fine,
 * worth watching or needing action, with what to do about it. The free-plan
 * figures are Supabase's (checked Oct 2026); what only Vercel's or Supabase's
 * dashboards know is linked, not guessed.
 */

export type Level = "ok" | "watch" | "act" | "unknown";

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Supabase's free plan. */
export const FREE_PLAN = {
  /** The database size quota (all databases of the project); over it the project may be restricted. */
  databaseBytes: 500 * MB,
  /** The fixed disk (database and its write-ahead log); at 95 % the database turns read-only. */
  diskBytes: 2 * GB,
  /** Supabase Storage (files, images). */
  storageBytes: 1 * GB,
} as const;

/** A share of a limit is worth watching from here … */
export const WATCH_AT = 0.7;
/** … and needs action from here. */
export const ACT_AT = 0.9;

/** Links to the providers' own pages: generic addresses that name no account (the repository is never linked from the site). */
export const LINKS = {
  supabaseUsage: "https://supabase.com/dashboard/org/_/usage",
  supabaseBilling: "https://supabase.com/dashboard/org/_/billing",
  vercelUsage: "https://vercel.com/dashboard/usage",
  anthropicUsage: "https://platform.claude.com/usage",
} as const;

/** The project's database report (the `_` placeholder lets Supabase ask for the project). */
export function supabaseDatabaseReport(ref: string | null): string {
  return `https://supabase.com/dashboard/project/${ref ?? "_"}/observability/database`;
}

/** The project ref from its URL (https://<ref>.supabase.co). */
export function supabaseRef(url: string | undefined): string | null {
  const match = url ? /^https:\/\/([a-z0-9]{10,40})\.supabase\.co\/?$/.exec(url.trim()) : null;
  return match ? match[1] : null;
}

export interface UsageTable {
  name: string;
  bytes: number;
  rows: number;
}

export interface CronJob {
  name: string;
  active: boolean;
  status: string | null;
  startedAt: string | null;
  message: string | null;
}

/** public.usage_snapshot() (migration 0019), read tolerantly. */
export interface UsageSnapshot {
  databasesBytes: number | null;
  walBytes: number | null;
  connections: number | null;
  maxConnections: number | null;
  cacheHit: number | null;
  cacheReads: number;
  tables: UsageTable[];
  storageBytes: number | null;
  storageObjects: number | null;
  /** null without pg_cron. */
  cron: CronJob[] | null;
}

const num = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
};
const text = (value: unknown): string | null => (typeof value === "string" ? value : null);
const iso = (value: unknown): string | null => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(Date.parse(value)).toISOString() : null);

export function parseUsageSnapshot(value: unknown): UsageSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const tables = Array.isArray(raw.tables)
    ? raw.tables.flatMap((entry) => {
        const row = entry as Record<string, unknown> | null;
        const name = text(row?.name);
        return name ? [{ name, bytes: num(row?.bytes) ?? 0, rows: num(row?.rows) ?? 0 }] : [];
      })
    : [];
  const cron = Array.isArray(raw.cron)
    ? raw.cron.flatMap((entry) => {
        const job = entry as Record<string, unknown> | null;
        const name = text(job?.name);
        return name ? [{ name, active: job?.active !== false, status: text(job?.status), startedAt: iso(job?.started_at), message: text(job?.message) }] : [];
      })
    : null;
  return {
    databasesBytes: num(raw.databases_bytes),
    walBytes: num(raw.wal_bytes),
    connections: num(raw.connections),
    maxConnections: num(raw.max_connections),
    cacheHit: num(raw.cache_hit),
    cacheReads: num(raw.cache_reads) ?? 0,
    tables,
    storageBytes: num(raw.storage_bytes),
    storageObjects: num(raw.storage_objects),
    cron,
  };
}

/** A job's note of its last run (app_config last_backup / last_prune). */
export function parseJobRun(value: unknown): { at: string } | null {
  const at = value && typeof value === "object" ? iso((value as Record<string, unknown>).at) : null;
  return at ? { at } : null;
}

export interface UsageInput {
  snapshot: UsageSnapshot | null;
  rally: { browsers: number; rooms: number } | null;
  alliances: Pick<AllianceSyncState, "at" | "ok">;
  giftCodes: Pick<GiftCodeSyncState, "at" | "okAt" | "listed">;
  backup: { at: string } | null;
  prune: { at: string } | null;
  translation: { configured: boolean; paused: boolean; label: string };
  supabaseRef: string | null;
}

export interface Check {
  id: string;
  title: string;
  value: string;
  level: Level;
  detail: string;
  /** For a bar: the share of the limit used (0–1). */
  share?: number;
  /** Where to look or act; an admin path starts with "/". */
  link?: { label: string; href: string };
}

export function shareLevel(share: number): Level {
  return share >= ACT_AT ? "act" : share >= WATCH_AT ? "watch" : "ok";
}

/** Fine while the last run is at most `watchAfter` old, worth watching up to `actAfter`, then action. */
export function ageLevel(at: string | null, now: number, watchAfter: number, actAfter: number): Level {
  if (!at) return "watch";
  const age = now - Date.parse(at);
  return age > actAfter ? "act" : age > watchAfter ? "watch" : "ok";
}

export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${Number((bytes / GB).toFixed(2))} GB`;
  if (bytes >= MB) return `${Number((bytes / MB).toFixed(1))} MB`;
  return `${bytes > 0 ? Math.max(1, Math.round(bytes / 1024)) : 0} kB`;
}

const percent = (share: number) => `${share < 0.01 && share > 0 ? "<1" : Math.round(share * 100)} %`;

export function ago(at: string, now: number): string {
  const age = Math.max(0, now - Date.parse(at));
  if (age < MINUTE) return "just now";
  if (age < HOUR) return `${Math.floor(age / MINUTE)} min ago`;
  if (age < 2 * DAY) return `${Math.floor(age / HOUR)} h ago`;
  return `${Math.floor(age / DAY)} days ago`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en")} ${n === 1 ? one : many}`;

/** The idle-room cleanup runs every five minutes; a quarter of an hour without a run means pg_cron stalled. */
const ROOM_CLEANUP_JOB = "rally-sync-close-idle-rooms";
const CRON_STALE = 15 * MINUTE;

function databaseChecks(snapshot: UsageSnapshot | null, ref: string | null): Check[] {
  const report = { label: "Supabase database report", href: supabaseDatabaseReport(ref) };
  if (!snapshot) {
    return [
      {
        id: "database",
        title: "Database size",
        value: "Couldn't be read",
        level: "unknown",
        detail: "The database didn't answer the usage question (migration 0019 may still be on its way). Reload in a minute; if it stays, look at Supabase directly.",
        link: report,
      },
    ];
  }
  const checks: Check[] = [];
  if (snapshot.databasesBytes !== null) {
    const share = snapshot.databasesBytes / FREE_PLAN.databaseBytes;
    const biggest = snapshot.tables
      .slice(0, 3)
      .map((table) => `${table.name} ${formatBytes(table.bytes)}`)
      .join(", ");
    checks.push({
      id: "database",
      title: "Database size",
      value: `${formatBytes(snapshot.databasesBytes)} of ${formatBytes(FREE_PLAN.databaseBytes)} (${percent(share)})`,
      level: shareLevel(share),
      share,
      detail: `The free plan counts 500 MB; above it Supabase may restrict the project. Biggest tables: ${biggest || "none"} (all of them below). Old battle feedback can be deleted on the Feedback page; finished rally rooms go by themselves.`,
      link: report,
    });
  }
  if (snapshot.databasesBytes !== null && snapshot.walBytes !== null) {
    const used = snapshot.databasesBytes + snapshot.walBytes;
    const share = used / FREE_PLAN.diskBytes;
    checks.push({
      id: "disk",
      title: "Disk",
      value: `${formatBytes(used)} of ${formatBytes(FREE_PLAN.diskBytes)} (${percent(share)})`,
      level: shareLevel(share),
      share,
      detail: `The database plus its write-ahead log (${formatBytes(snapshot.walBytes)}). The free plan's disk is 2 GB and doesn't grow: at 95 % the database turns read-only and every save fails until space is freed or the plan upgraded.`,
      link: { label: "Supabase billing (upgrade)", href: LINKS.supabaseBilling },
    });
  }
  checks.push(
    snapshot.storageBytes === null
      ? { id: "storage", title: "File storage", value: "Couldn't be read", level: "unknown", detail: "Images and files in Supabase Storage (free plan: 1 GB)." }
      : {
          id: "storage",
          title: "File storage",
          value: `${formatBytes(snapshot.storageBytes)} of ${formatBytes(FREE_PLAN.storageBytes)}, ${plural(snapshot.storageObjects ?? 0, "file")}`,
          level: shareLevel(snapshot.storageBytes / FREE_PLAN.storageBytes),
          share: snapshot.storageBytes / FREE_PLAN.storageBytes,
          detail: "Images and files in Supabase Storage (free plan: 1 GB). The site keeps none there yet; the content editor will.",
        },
  );
  if (snapshot.connections !== null && snapshot.maxConnections) {
    const share = snapshot.connections / snapshot.maxConnections;
    checks.push({
      id: "connections",
      title: "Database connections",
      value: `${snapshot.connections} of ${snapshot.maxConnections} open`,
      level: shareLevel(share),
      share,
      detail: "Connections to the database right now, the site's and Supabase's own. Near the maximum, pages wait or fail: usually a burst of visitors, or a stuck job.",
      link: report,
    });
  }
  const tooFew = snapshot.cacheHit === null || snapshot.cacheReads < 10_000;
  checks.push({
    id: "cache",
    title: "Speed: reads from memory",
    value: tooFew ? "Too few reads yet to judge" : `${(snapshot.cacheHit! * 100).toFixed(1)} %`,
    level: tooFew ? "ok" : snapshot.cacheHit! >= 0.99 ? "ok" : snapshot.cacheHit! >= 0.95 ? "watch" : "act",
    detail:
      "The share of table reads served from memory since the database last restarted. Below 99 % it works from disk more and pages slow down: usually the data has outgrown the free plan's memory.",
    link: report,
  });
  return checks;
}

function cronCheck(snapshot: UsageSnapshot | null, now: number): Check | null {
  if (!snapshot) return null;
  if (snapshot.cron === null) {
    return {
      id: "cron",
      title: "Database jobs (pg_cron)",
      value: "pg_cron isn't on",
      level: "watch",
      detail: "Without it, closed rally rooms are deleted only by the daily prune. Supabase → Integrations → Cron turns it on; then run the Deploy database workflow again.",
    };
  }
  const failed = snapshot.cron.filter((job) => job.status === "failed");
  const cleanup = snapshot.cron.find((job) => job.name === ROOM_CLEANUP_JOB);
  const stalled = cleanup?.active && cleanup.startedAt !== null && now - Date.parse(cleanup.startedAt) > CRON_STALE;
  const missing = !cleanup;
  return {
    id: "cron",
    title: "Database jobs (pg_cron)",
    value:
      failed.length > 0
        ? `${failed.map((job) => job.name).join(", ")} failed`
        : missing
          ? "The idle-room cleanup isn't scheduled"
          : `${plural(snapshot.cron.length, "job")}, last runs fine${cleanup?.startedAt ? ` (room cleanup ${ago(cleanup.startedAt, now)})` : ""}`,
    level: failed.length > 0 ? "act" : stalled || missing ? "watch" : "ok",
    detail:
      failed.length > 0
        ? `Supabase says: ${failed.map((job) => `${job.name}: ${job.message ?? "no message"}`).join("; ")}. The daily prune still closes rooms meanwhile.`
        : stalled
          ? "The room cleanup runs every five minutes but hasn't for a while. The daily prune still closes rooms; look at Supabase → Integrations → Cron."
          : "Closed rally rooms are deleted every five minutes, and pg_cron's run history after three days.",
  };
}

function jobChecks(input: UsageInput, now: number): Check[] {
  const checks: Check[] = [];
  checks.push(
    input.rally === null
      ? { id: "realtime", title: "Rally Sync: live browsers", value: "Couldn't be read", level: "unknown", detail: "Each browser with a room open holds a live connection." }
      : {
          id: "realtime",
          title: "Rally Sync: live browsers",
          value: `${plural(input.rally.browsers, "browser")} of ${BROWSER_BUDGET}, in ${plural(input.rally.rooms, "open room")}`,
          level: shareLevel(input.rally.browsers / BROWSER_BUDGET),
          share: input.rally.browsers / BROWSER_BUDGET,
          detail: "Each browser with a room open holds one of the free plan's 200 live connections; the room limits keep them within 180.",
          link: { label: "Rally Sync limits", href: "/settings/rally-sync" },
        },
  );
  const cron = cronCheck(input.snapshot, now);
  if (cron) checks.push(cron);
  checks.push({
    id: "backup",
    title: "Weekly backup",
    value: input.backup ? `Last one ${ago(input.backup.at, now)}` : "None noted yet",
    level: ageLevel(input.backup?.at ?? null, now, 8 * DAY, 15 * DAY),
    detail: input.backup
      ? "Every Monday, 04:17 UTC (GitHub → Actions → Maintenance). GitHub pauses the schedule after 60 days without a commit: then open the workflow and press Enable, or run the backup by hand."
      : "The backup notes itself here from its next run (Mondays, 04:17 UTC). Run Maintenance → backup in GitHub Actions to see it now.",
  });
  checks.push({
    id: "prune",
    title: "Daily cleanup",
    value: input.prune ? `Last one ${ago(input.prune.at, now)}` : "None noted yet",
    level: ageLevel(input.prune?.at ?? null, now, 26 * HOUR, 50 * HOUR),
    detail: input.prune
      ? "Every day, 05:41 UTC (GitHub → Actions → Maintenance): battle feedback past its retention and closed rally rooms."
      : "The cleanup notes itself here from its next run (daily, 05:41 UTC, GitHub → Actions → Maintenance).",
  });
  const alliances = input.alliances;
  const alliancesAge = ageLevel(alliances.at, now, 26 * HOUR, 50 * HOUR);
  checks.push({
    id: "alliances",
    title: "Alliance sync (MightPulse)",
    value: alliances.at ? `Last one ${ago(alliances.at, now)}${alliances.ok ? "" : ", failed"}` : "Not synced yet",
    level: alliancesAge !== "ok" ? alliancesAge : alliances.ok ? "ok" : "watch",
    detail: "Daily at 06:07 UTC. A failure leaves the alliances' numbers as they were; Sync now on the Alliances tab tries again.",
    link: { label: "Alliances tab", href: "/settings/alliances" },
  });
  const gifts = input.giftCodes;
  checks.push({
    id: "gift-codes",
    title: "Gift codes (kingshot.net)",
    value: gifts.okAt ? `Last good check ${ago(gifts.okAt, now)}, ${plural(gifts.listed, "working code")}` : gifts.at ? "No good check yet" : "Not checked yet",
    level: ageLevel(gifts.okAt, now, 2 * HOUR, 6 * HOUR),
    detail: "Every hour. A few failed checks only delay new codes; after six hours the workflow run fails and GitHub e-mails you.",
    link: { label: "Gift codes page", href: "/gift-codes" },
  });
  const { translation } = input;
  checks.push({
    id: "translation",
    title: "Machine translation",
    value: !translation.configured ? "No provider key" : translation.paused ? "Paused" : `On (${translation.label})`,
    level: !translation.configured || translation.paused ? "watch" : "ok",
    detail: translation.paused
      ? "New and changed texts stay English until you resume it on the General tab, then run Maintenance → translate once."
      : "Each new or changed text is translated once, on Claude Haiku by default; the bill is on Anthropic's usage page.",
    link: translation.paused ? { label: "General tab", href: "/settings" } : { label: "Anthropic usage", href: LINKS.anthropicUsage },
  });
  return checks;
}

export interface UsageReport {
  database: Check[];
  jobs: Check[];
  tables: UsageTable[];
}

export function usageReport(input: UsageInput, now: number): UsageReport {
  return { database: databaseChecks(input.snapshot, input.supabaseRef), jobs: jobChecks(input, now), tables: input.snapshot?.tables ?? [] };
}

export interface Verdict {
  level: "ok" | "watch" | "act";
  act: Check[];
  /** Worth watching, and what couldn't be read. */
  watch: Check[];
}

export function verdict(checks: readonly Check[]): Verdict {
  const act = checks.filter((check) => check.level === "act");
  const watch = checks.filter((check) => check.level === "watch" || check.level === "unknown");
  return { level: act.length > 0 ? "act" : watch.length > 0 ? "watch" : "ok", act, watch };
}

/** "All fine", "2 to watch", "1 needs action, 1 to watch". */
export function verdictLine(result: Verdict): string {
  if (result.level === "ok") return "All fine";
  const parts = [result.act.length > 0 && `${result.act.length} ${result.act.length === 1 ? "needs" : "need"} action`, result.watch.length > 0 && `${result.watch.length} to watch`];
  return parts.filter(Boolean).join(", ");
}
