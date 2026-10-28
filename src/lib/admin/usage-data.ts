import { parseAllianceSyncState } from "@/lib/alliances/sync-plan";
import { type ConfigKey, readConfig } from "@/lib/config/app-config";
import { getTranslationSettings } from "@/lib/config/settings";
import { parseGiftCodeSyncState } from "@/lib/gift-codes/sync-plan";
import { createLogger } from "@/lib/log";
import { CAPACITY_MODES } from "@/lib/rally-sync/capacity";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, supabaseUrl } from "@/lib/supabase/env";
import { isTranslationConfigured, translationProviderLabel } from "@/lib/translate/provider";
import { type Check, parseJobRun, parseUsageSnapshot, supabaseRef, type UsageReport, type UsageSnapshot, usageReport, type Verdict, verdict } from "@/lib/usage/health";
import type { RallyCapacitySettings } from "./settings-data";

/**
 * The owner's Usage tab (server only, called through settings-data's owner
 * check): the database's own figures (public.usage_snapshot, migration 0019),
 * the background jobs' notes in app_config and the live Rally Sync browsers,
 * judged by the pure rules in src/lib/usage/health.ts. Uncached: it is read
 * when the owner looks.
 */

const log = createLogger("admin");

export interface UsageData {
  report: UsageReport;
  verdict: Verdict;
  /** When these numbers were taken (ISO). */
  checkedAt: string;
}

async function snapshot(): Promise<UsageSnapshot | null> {
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await createAdminClient().rpc("usage_snapshot");
  if (error) {
    log.warn("Could not read the usage snapshot", { code: error.code, error: error.message });
    return null;
  }
  return parseUsageSnapshot(data);
}

async function config(key: ConfigKey): Promise<unknown> {
  if (!isSupabaseAdminConfigured()) return null;
  try {
    return await readConfig(createAdminClient(), key);
  } catch (error) {
    log.warn("Could not read a setting for the Usage tab", { key, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function usageData(rally: RallyCapacitySettings): Promise<UsageData> {
  const [usage, alliances, giftCodes, backup, prune, translation, label] = await Promise.all([
    snapshot(),
    config("alliance_sync"),
    config("gift_code_sync"),
    config("last_backup"),
    config("last_prune"),
    getTranslationSettings(),
    translationProviderLabel(),
  ]);
  const now = Date.now();
  const report = usageReport(
    {
      snapshot: usage,
      rally: rally.available
        ? {
            browsers: CAPACITY_MODES.reduce((sum, mode) => sum + rally.usage[mode].browsers, 0),
            rooms: CAPACITY_MODES.reduce((sum, mode) => sum + rally.usage[mode].rooms, 0),
          }
        : null,
      alliances: parseAllianceSyncState(alliances),
      giftCodes: parseGiftCodeSyncState(giftCodes),
      backup: parseJobRun(backup),
      prune: parseJobRun(prune),
      translation: { configured: isTranslationConfigured(), paused: translation.paused, label },
      supabaseRef: supabaseRef(supabaseUrl()),
    },
    now,
  );
  const checks: Check[] = [...report.database, ...report.jobs];
  return { report, verdict: verdict(checks), checkedAt: new Date(now).toISOString() };
}
