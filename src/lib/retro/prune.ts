import type { SupabaseClient } from "@supabase/supabase-js";
import { isDue, pruneAt } from "./retention";

/**
 * Deletes the feedback of battles whose retention period is over and closes
 * their forms. Run by `npm run prune` (the Maintenance task `prune`, daily).
 * Framework-free so the script can import it; every deletion is written to
 * audit_log as a "Site" entry with the count, never the content.
 */

export interface PruneResult {
  retroId: string;
  planSlug: string;
  deleted: number;
  pruneAt: string;
}

export interface PruneOptions {
  dryRun?: boolean;
  log?: (line: string) => void;
}

interface RetroRow {
  id: string;
  plan_id: string;
  open: boolean;
  created_at: string;
  retention_days: number;
}

interface PlanRow {
  id: string;
  slug: string;
  battle_at: string | null;
}

/** The retrospectives whose data is due for deletion at `now` (pure part, unit-tested). */
export function dueRetrospectives(retros: readonly RetroRow[], plans: readonly PlanRow[], now: Date): Array<RetroRow & { plan: PlanRow; pruneAt: Date }> {
  const byId = new Map(plans.map((p) => [p.id, p]));
  const out: Array<RetroRow & { plan: PlanRow; pruneAt: Date }> = [];
  for (const retro of retros) {
    const plan = byId.get(retro.plan_id);
    if (!plan) continue;
    const input = { battleAt: plan.battle_at, createdAt: retro.created_at, retentionDays: Number(retro.retention_days) || 30 };
    if (isDue(input, now)) out.push({ ...retro, plan, pruneAt: pruneAt(input) });
  }
  return out;
}

export async function pruneExpiredResponses(admin: SupabaseClient, now: Date, options: PruneOptions = {}): Promise<PruneResult[]> {
  const log = options.log ?? (() => {});
  const { data: retros, error } = await admin.from("kvk_retrospectives").select("id, plan_id, open, created_at, retention_days");
  if (error) throw new Error(`kvk_retrospectives: ${error.message}`);
  if (!retros || retros.length === 0) {
    log("No retrospectives.");
    return [];
  }
  const { data: plans, error: planError } = await admin.from("kvk_plans").select("id, slug, battle_at").in("id", retros.map((r) => r.plan_id));
  if (planError) throw new Error(`kvk_plans: ${planError.message}`);

  const due = dueRetrospectives(retros as RetroRow[], (plans ?? []) as PlanRow[], now);
  if (due.length === 0) {
    log(`Nothing to prune (${retros.length} retrospective${retros.length === 1 ? "" : "s"}, none past retention).`);
    return [];
  }

  const results: PruneResult[] = [];
  for (const retro of due) {
    const { count, error: countError } = await admin.from("kvk_retro_responses").select("id", { count: "exact", head: true }).eq("retrospective_id", retro.id);
    if (countError) throw new Error(`counting ${retro.plan.slug}: ${countError.message}`);
    const deleted = count ?? 0;
    const result: PruneResult = { retroId: retro.id, planSlug: retro.plan.slug, deleted, pruneAt: retro.pruneAt.toISOString() };
    if (options.dryRun) {
      log(`[dry run] ${retro.plan.slug}: would delete ${deleted} response${deleted === 1 ? "" : "s"}${retro.open ? " and close the form" : ""}`);
      results.push(result);
      continue;
    }
    if (deleted > 0) {
      const { error: deleteError } = await admin.from("kvk_retro_responses").delete().eq("retrospective_id", retro.id);
      if (deleteError) throw new Error(`deleting ${retro.plan.slug}: ${deleteError.message}`);
    }
    if (retro.open) {
      const { error: closeError } = await admin.from("kvk_retrospectives").update({ open: false }).eq("id", retro.id);
      if (closeError) throw new Error(`closing ${retro.plan.slug}: ${closeError.message}`);
    }
    if (deleted > 0 || retro.open) {
      const { error: auditError } = await admin.from("audit_log").insert({
        actor_id: null,
        actor_name: "Site",
        action: "retro.prune",
        table_name: "kvk_retro_responses",
        row_id: retro.id,
        details: { planSlug: retro.plan.slug, deleted, closed: retro.open, pruneAt: result.pruneAt, summary: `${deleted} response${deleted === 1 ? "" : "s"} deleted` },
      });
      if (auditError) log(`warning: audit entry for ${retro.plan.slug} failed: ${auditError.message}`);
    }
    log(`${retro.plan.slug}: deleted ${deleted} response${deleted === 1 ? "" : "s"}${retro.open ? ", form closed" : ""}`);
    results.push(result);
  }
  return results;
}
