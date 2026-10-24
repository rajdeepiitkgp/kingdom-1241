import { checkAccess } from "@/lib/auth/server";
import { mapRetroBattle, mapRetroResponse, mapRetrospective } from "@/lib/data/mappers";
import type { RetroBattle, RetroResponse, Retrospective } from "@/lib/data/types";
import { createLogger } from "@/lib/log";
import { pruneAt } from "@/lib/retro/retention";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "./forms";
import { pendingColumns } from "./translation";

/**
 * Uncached, service-role reads for the Feedback pages. Server only, after the
 * role check. Player identity (Governor ID, in-game name) is returned to the
 * site owner only; everyone else gets the answers without it.
 */

const log = createLogger("admin");

export interface AdminRetrospective extends Retrospective {
  plan: RetroBattle;
  responseCount: number;
  /** When the Maintenance task deletes the responses (ISO). */
  pruneAt: string;
  /** Columns the pipeline still has to translate ("title", "intro"). */
  pendingColumns: string[];
}

async function allowed(what: string): Promise<{ isOwner: boolean } | null> {
  const access = await checkAccess("moderator");
  if ("denied" in access) {
    log.warn("Admin data requested without access", { what, reason: access.denied });
    return null;
  }
  return { isOwner: access.user.isOwner };
}

type Row = Record<string, unknown>;

function toAdmin(row: Row, plan: Row, count: number): AdminRetrospective {
  const retro = mapRetrospective(row);
  const { password: _password, ...battle } = mapRetroBattle(plan);
  void _password;
  return {
    ...retro,
    plan: battle,
    responseCount: count,
    pruneAt: pruneAt({ battleAt: battle.battleAt, createdAt: retro.createdAt, retentionDays: retro.retentionDays }).toISOString(),
    pendingColumns: pendingColumns("kvk_retrospectives", row),
  };
}

async function countsByRetro(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  // One count query per retrospective: there are a handful, and PostgREST has no group-by.
  await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await createAdminClient().from("kvk_retro_responses").select("id", { count: "exact", head: true }).eq("retrospective_id", id);
      if (error) log.warn("Could not count feedback", { retro: id, error: error.message });
      counts.set(id, count ?? 0);
    }),
  );
  return counts;
}

export async function listRetrospectives(): Promise<AdminRetrospective[]> {
  if (!(await allowed("retrospectives"))) return [];
  const admin = createAdminClient();
  const { data: retros, error } = await admin.from("kvk_retrospectives").select("*").order("open", { ascending: false }).order("updated_at", { ascending: false });
  if (error) {
    log.error("Could not list retrospectives", { error: error.message });
    return [];
  }
  if (!retros || retros.length === 0) return [];
  const { data: plans, error: planError } = await admin
    .from("kvk_plans")
    .select("id, slug, title, event_type, battle_at")
    .in("id", retros.map((r) => String(r.plan_id)));
  if (planError) {
    log.error("Could not load the retrospectives' plans", { error: planError.message });
    return [];
  }
  const planById = new Map((plans ?? []).map((p) => [String(p.id), p as Row]));
  const counts = await countsByRetro(retros.map((r) => String(r.id)));
  return retros
    .filter((r) => planById.has(String(r.plan_id)))
    .map((r) => toAdmin(r as Row, planById.get(String(r.plan_id))!, counts.get(String(r.id)) ?? 0))
    .sort((a, b) => Number(b.open) - Number(a.open) || (b.plan.battleAt ?? "").localeCompare(a.plan.battleAt ?? "") || b.updatedAt.localeCompare(a.updatedAt));
}

export async function getRetrospectiveByPlan(planId: string): Promise<AdminRetrospective | null> {
  if (!isUuid(planId)) return null;
  if (!(await allowed("retrospective"))) return null;
  const admin = createAdminClient();
  const [{ data: retro, error }, { data: plan, error: planError }] = await Promise.all([
    admin.from("kvk_retrospectives").select("*").eq("plan_id", planId).maybeSingle(),
    admin.from("kvk_plans").select("id, slug, title, event_type, battle_at").eq("id", planId).maybeSingle(),
  ]);
  if (error || planError) {
    log.error("Could not load the retrospective", { planId, error: error?.message ?? planError?.message });
    return null;
  }
  if (!retro || !plan) return null;
  const counts = await countsByRetro([String(retro.id)]);
  return toAdmin(retro as Row, plan as Row, counts.get(String(retro.id)) ?? 0);
}

/** All answers of a retrospective, newest first. `identity` is honoured for the owner only. */
export async function listResponses(retroId: string, options: { identity: boolean }): Promise<RetroResponse[]> {
  if (!isUuid(retroId)) return [];
  const access = await allowed("responses");
  if (!access) return [];
  const identity = options.identity && access.isOwner;
  const columns = identity ? "*" : "id, retrospective_id, alliance_tag, verified, ratings, went_well, went_wrong, suggestions, texts_en, translated_at, locale, created_at";
  const { data, error } = await createAdminClient()
    .from("kvk_retro_responses")
    .select(columns)
    .eq("retrospective_id", retroId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    log.error("Could not load feedback", { retro: retroId, error: error.message });
    return [];
  }
  return ((data ?? []) as unknown as Row[]).map((row) => mapRetroResponse(row, identity));
}
