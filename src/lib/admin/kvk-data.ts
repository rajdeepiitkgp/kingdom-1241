import { mapKvkCoordinator, mapKvkFormation, mapKvkPlan, mapKvkRule } from "@/lib/data/mappers";
import type { KvkEventType, KvkPlanWithSecret } from "@/lib/data/types";
import { pick, type Localized } from "@/lib/i18n/localized";
import { checkAccess } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { htmlToEditableText, isUuid } from "./forms";
import { pendingColumns } from "./translation";

/**
 * Uncached, service-role reads for the battle-plan editor. Unlike the public
 * loader these return every plan and every child row, published or not.
 * Server only, after the role check.
 */

const log = createLogger("admin");

export interface AdminPlanSummary {
  id: string;
  slug: string;
  title: Localized;
  eventType: KvkEventType;
  battleAt: string | null;
  active: boolean;
  published: boolean;
  updatedAt: string;
  formationCount: number;
}

async function allowed(what: string): Promise<boolean> {
  const access = await checkAccess("moderator");
  if ("denied" in access) {
    log.warn("Admin data requested without access", { what, reason: access.denied });
    return false;
  }
  return true;
}

export async function listPlans(): Promise<AdminPlanSummary[]> {
  if (!(await allowed("plans"))) return [];
  const admin = createAdminClient();
  const [plans, formations] = await Promise.all([
    admin
      .from("kvk_plans")
      .select("id, slug, title, event_type, battle_at, active, published, updated_at")
      .order("active", { ascending: false })
      .order("battle_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    admin.from("kvk_formations").select("plan_id"),
  ]);
  if (plans.error) {
    log.error("Could not list plans", { error: plans.error.message });
    return [];
  }
  // The counts are decoration: the list still works without them.
  if (formations.error) log.warn("Could not count formations", { error: formations.error.message });
  const counts = new Map<string, number>();
  for (const row of formations.data ?? []) {
    const id = String(row.plan_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return (plans.data ?? []).map((row) => {
    const mapped = mapKvkPlan(row, [], [], []);
    return {
      id: mapped.id,
      slug: mapped.slug,
      title: mapped.title,
      eventType: mapped.eventType,
      battleAt: mapped.battleAt,
      active: mapped.active,
      published: mapped.published,
      updatedAt: mapped.updatedAt,
      formationCount: counts.get(mapped.id) ?? 0,
    };
  });
}

/** A plan with all of its rows (including unpublished ones), the Markdown sources of the intro and translation state. */
export interface AdminKvkPlan extends KvkPlanWithSecret {
  /** English Markdown source of the intro. */
  introSource: string;
  /** Markdown source per language (missing languages are derived from their HTML on demand). */
  introSources: Localized;
  /** Columns of the plan row the pipeline still has to translate ("title", "intro"). */
  pendingColumns: string[];
  /** Columns the pipeline still has to translate, per child row id. */
  pendingRows: Record<string, string[]>;
}

export async function getPlanForEditing(id: string): Promise<AdminKvkPlan | null> {
  if (!isUuid(id)) return null;
  if (!(await allowed("plan"))) return null;
  const admin = createAdminClient();
  const { data: plan, error } = await admin.from("kvk_plans").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error("Could not load the plan", { id, error: error.message });
    return null;
  }
  if (!plan) return null;

  const [rules, coordinators, formations] = await Promise.all([
    admin.from("kvk_rules").select("*").eq("plan_id", id).order("sort_order"),
    admin.from("kvk_coordinators").select("*").eq("plan_id", id).order("sort_order"),
    admin.from("kvk_formations").select("*").eq("plan_id", id).order("sort_order"),
  ]);
  for (const result of [rules, coordinators, formations]) {
    if (result.error) {
      log.error("Could not load the plan's rows", { id, error: result.error.message });
      return null;
    }
  }

  const base = mapKvkPlan(plan, [], [], []);
  const introSources: Localized =
    plan.intro_source && typeof plan.intro_source === "object"
      ? Object.fromEntries(Object.entries(plan.intro_source as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [string, string][])
      : {};
  const introSource = introSources.en?.trim() ? introSources.en : htmlToEditableText(pick(base.intro, "en"));
  const pendingRows: Record<string, string[]> = {};
  for (const [table, result] of [["kvk_rules", rules], ["kvk_coordinators", coordinators], ["kvk_formations", formations]] as const) {
    for (const row of result.data ?? []) {
      const columns = pendingColumns(table, row);
      if (columns.length > 0) pendingRows[String(row.id)] = columns;
    }
  }
  return {
    ...base,
    introSource,
    introSources,
    pendingColumns: pendingColumns("kvk_plans", plan),
    pendingRows,
    rules: (rules.data ?? []).map(mapKvkRule),
    coordinators: (coordinators.data ?? []).map(mapKvkCoordinator),
    formations: (formations.data ?? []).map(mapKvkFormation),
  };
}
