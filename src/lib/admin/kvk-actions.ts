"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess, type CurrentUser } from "@/lib/auth/server";
import { CACHE_TAGS, getEnabledLocales } from "@/lib/data";
import { markdownToHtml } from "@/lib/html";
import { isLocaleCode } from "@/lib/i18n/languages";
import type { Localized } from "@/lib/i18n/localized";
import type { KvkArea } from "@/lib/kvk/access";
import type { Logger } from "@/lib/log";
import { battleMinutes } from "@/lib/kvk/battle-window";
import { latestPetsOffset } from "@/lib/kvk/leaders";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField, localizedUpdate, textField, uuidField } from "./forms";
import {
  isMoveDirection,
  MAX_FORMATIONS,
  moveInList,
  type OtherPasswords,
  parseChecklistItemForm,
  parseChecklistRuleForm,
  parseCoordinatorForm,
  parseFormationForm,
  parseLeaderRuleForm,
  parsePageBriefForm,
  parsePlanForm,
  parseRallyLeaderForm,
  parseRuleForm,
  passwordClash,
} from "./kvk-forms";
import { isEditableTextColumn, pendingColumns, TEXT_LIMITS, withLanguage } from "./translation";

/**
 * Server Actions of the battle-plan editor. Every action re-checks the role
 * (these are reachable by a direct POST), writes with the service role, logs
 * to the audit table and expires the public page cache (`content:kvk`), so
 * players see the change on their next request. Field parsing is in
 * kvk-forms.ts, the shared replies in action-helpers.ts.
 */

const PLAN_GONE: ActionState = { status: "error", message: "This plan no longer exists." };

/** Columns a copied row must not carry over. */
const ROW_META = new Set(["id", "created_at", "updated_at", "source_hash"]);

function withoutRowMeta(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !ROW_META.has(key)));
}

/** The plan's editor, or with `page` one of its sub-pages ("/leaders", "/checklist"). */
function editorPath(locale: string, planId: string, anchor?: string, query?: string, page = ""): string {
  return adminPath(locale, `/kvk/${planId}${page}${query ? `?${query}` : ""}${anchor ? `#${anchor}` : ""}`);
}

const LEADERS_PAGE = "/leaders";
const CHECKLIST_PAGE = "/checklist";

/** Players see the change on their next request; the editors re-render in place. */
function expirePlanCaches(locale: string, planId: string) {
  updateTag(CACHE_TAGS.kvk);
  revalidatePath(editorPath(locale, planId));
  revalidatePath(editorPath(locale, planId, undefined, undefined, LEADERS_PAGE));
  revalidatePath(editorPath(locale, planId, undefined, undefined, CHECKLIST_PAGE));
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function savePlan(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  const admin = createAdminClient();

  type ExistingPlan = { title: Localized; intro: Localized; intro_source: Localized | null; battle_at: string | null; battle_end_at?: string | null };
  let existing: ExistingPlan | null = null;
  if (id) {
    const { data } = await admin.from("kvk_plans").select("*").eq("id", id).maybeSingle();
    if (!data) return PLAN_GONE;
    existing = data as ExistingPlan;
  }

  // A changed battle time must lie ahead; an old plan keeps its past time untouched.
  const parsed = parsePlanForm(formData, { now: new Date(), previousBattleAt: existing?.battle_at ?? null });
  if (!parsed.ok) return invalid(parsed.errors);
  const input = parsed.value;
  const clash = id ? passwordClash(input.password, await pagePasswords(id, ["leaders", "checklist"])) : null;
  if (clash) return invalid({ password: clash });

  // A changed English intro drops the other languages (HTML and Markdown sources alike);
  // the pipeline refills the HTML, and sources are re-derived from it when edited.
  const intro = localizedUpdate(existing?.intro, markdownToHtml(input.introSource));
  const introSource =
    existing && intro === existing.intro ? { ...(existing.intro_source ?? {}), en: input.introSource } : { en: input.introSource };

  const row: Record<string, unknown> = {
    slug: input.slug,
    event_type: input.eventType,
    title: localizedUpdate(existing?.title, input.title),
    opponent: input.opponent,
    battle_at: input.battleAt,
    intro,
    intro_source: introSource,
    min_hero_stars: input.minHeroStars,
    min_skill_level: input.minSkillLevel,
    password: input.password,
    active: input.active,
    published: input.published,
  };

  // The column arrives with migration 0009; until it is applied, a plan without an end time is saved as before.
  if (input.battleEndAt || (existing && "battle_end_at" in existing)) row.battle_end_at = input.battleEndAt;

  if (input.active) {
    // Only one plan can be active (unique partial index): switch the others off first.
    let deactivate = admin.from("kvk_plans").update({ active: false }).eq("active", true);
    if (id) deactivate = deactivate.neq("id", id);
    const { error } = await deactivate;
    if (error) return failed(log, "Deactivating other plans", error);
  }

  const result = id
    ? await admin.from("kvk_plans").update(row).eq("id", id).select("id").single()
    : await admin.from("kvk_plans").insert(row).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") return invalid({ slug: "Another plan already uses this slug." });
    return failed(log, "Saving the plan", result.error);
  }

  const planId = String(result.data.id);
  await audit(access.user, id ? "kvk_plan.update" : "kvk_plan.create", "kvk_plans", planId, {
    slug: input.slug,
    active: input.active,
    published: input.published,
  });
  expirePlanCaches(locale, planId);
  if (!id) redirect(editorPath(locale, planId));
  return { status: "saved", message: "Plan saved." };
}

export async function deletePlan(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("admin");
  if ("denied" in access) redirect(adminPath(locale, "/kvk?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/kvk"));
  const log = await actionLogger();

  const admin = createAdminClient();
  const { data, error } = await admin.from("kvk_plans").delete().eq("id", id).select("slug").maybeSingle();
  if (error) {
    log.error("Deleting the plan failed", { id, error: error.message });
    redirect(adminPath(locale, "/kvk?error=delete"));
  }
  await audit(access.user, "kvk_plan.delete", "kvk_plans", id, { slug: data?.slug ?? null });
  updateTag(CACHE_TAGS.kvk);
  redirect(adminPath(locale, "/kvk?deleted=1"));
}

/** Copies a plan with all its rows as an inactive, unpublished draft — the quickest way to prepare the next battle. */
export async function duplicatePlan(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, "/kvk?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/kvk"));
  const log = await actionLogger();

  const admin = createAdminClient();
  const { data: plan, error } = await admin.from("kvk_plans").select("*").eq("id", id).maybeSingle();
  if (error || !plan) redirect(adminPath(locale, "/kvk?error=missing"));

  const copyTitle = `Copy of ${String((plan.title as Localized)?.en ?? plan.slug)}`.slice(0, 120);
  const copy = await admin
    .from("kvk_plans")
    // The copy starts without a battle time: the next battle's date is always new.
    .insert({
      ...withoutRowMeta(plan as Record<string, unknown>),
      slug: `${String(plan.slug)}-copy-${Date.now().toString(36)}`.slice(0, 80),
      title: { en: copyTitle },
      battle_at: null,
      ...("battle_end_at" in plan ? { battle_end_at: null } : {}),
      active: false,
      published: false,
    })
    .select("id")
    .single();
  if (copy.error) {
    log.error("Duplicating the plan failed", { id, error: copy.error.message });
    redirect(adminPath(locale, "/kvk?error=duplicate"));
  }
  const newId = String(copy.data.id);

  // The leader page and the checklist come along (each brief is one row per plan; a table missing before its migration just copies nothing).
  for (const table of [
    "kvk_rules",
    "kvk_coordinators",
    "kvk_formations",
    "kvk_leader_briefs",
    "kvk_leader_rules",
    "kvk_rally_leaders",
    "kvk_checklist_briefs",
    "kvk_checklist_items",
    "kvk_checklist_rules",
  ] as const) {
    const { data: rows } = await admin.from(table).select("*").eq("plan_id", id);
    if (!rows || rows.length === 0) continue;
    // Rally start times belong to the old battle, like its battle time.
    const copies = rows.map((row) => ({ ...withoutRowMeta(row as Record<string, unknown>), plan_id: newId, ...(table === "kvk_rally_leaders" ? { start_at: null } : {}) }));
    const { error: copyError } = await admin.from(table).insert(copies);
    if (copyError) log.error("Copying plan rows failed", { table, from: id, to: newId, error: copyError.message });
  }

  await audit(access.user, "kvk_plan.duplicate", "kvk_plans", newId, { from: id });
  redirect(editorPath(locale, newId));
}

// ---------------------------------------------------------------------------
// Child rows: rules, coordinators, formations
// ---------------------------------------------------------------------------

type ChildTable =
  | "kvk_rules"
  | "kvk_coordinators"
  | "kvk_formations"
  | "kvk_leader_rules"
  | "kvk_rally_leaders"
  | "kvk_checklist_items"
  | "kvk_checklist_rules";
/** `page`: the editor sub-page the rows are edited on (the plan's editor when empty). */
const CHILD_TABLES: Record<ChildTable, { anchor: string; action: string; page: string }> = {
  kvk_rules: { anchor: "rules", action: "kvk_rule", page: "" },
  kvk_coordinators: { anchor: "coordinators", action: "kvk_coordinator", page: "" },
  kvk_formations: { anchor: "formations", action: "kvk_formation", page: "" },
  kvk_leader_rules: { anchor: "leader-rules", action: "kvk_leader_rule", page: LEADERS_PAGE },
  kvk_rally_leaders: { anchor: "rallies", action: "kvk_rally_leader", page: LEADERS_PAGE },
  kvk_checklist_items: { anchor: "checklist-items", action: "kvk_checklist_item", page: CHECKLIST_PAGE },
  kvk_checklist_rules: { anchor: "checklist-rules", action: "kvk_checklist_rule", page: CHECKLIST_PAGE },
};

function isChildTable(value: string): value is ChildTable {
  return value in CHILD_TABLES;
}

async function planExists(planId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("kvk_plans").select("id").eq("id", planId).maybeSingle();
  return Boolean(data);
}

/**
 * New rows go to the end of their list; admins reorder with the arrows
 * (moveRow), never by typing numbers. `null` when the list could not be read:
 * guessing 0 would put the new row at the top.
 */
async function nextSortOrder(log: Logger, table: ChildTable, planId: string): Promise<number | null> {
  const { data, error } = await createAdminClient()
    .from(table)
    .select("sort_order")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    log.error(`Reading the last position in ${table} failed`, { planId, error: error.message });
    return null;
  }
  return typeof data?.sort_order === "number" ? data.sort_order + 1 : 0;
}

async function saveChild(
  log: Logger,
  user: CurrentUser,
  table: ChildTable,
  action: string,
  locale: string,
  planId: string,
  id: string | null,
  row: Record<string, unknown>,
): Promise<ActionState> {
  const admin = createAdminClient();
  let result;
  if (id) {
    result = await admin.from(table).update(row).eq("id", id).eq("plan_id", planId).select("id").single();
  } else {
    const sortOrder = await nextSortOrder(log, table, planId);
    if (sortOrder === null) return failed(log, `Saving ${table}`, { message: "position unknown" });
    result = await admin.from(table).insert({ ...row, plan_id: planId, sort_order: sortOrder }).select("id").single();
  }
  if (result.error) {
    // Only formations have a unique key (plan + preset letter, migration 0002); elsewhere 23505 is unexpected.
    if (result.error.code === "23505" && table === "kvk_formations") return invalid({ label: "This preset letter is already used in this plan." });
    return failed(log, `Saving ${table}`, result.error);
  }
  await audit(user, action, table, String(result.data.id), { planId });
  expirePlanCaches(locale, planId);
  return { status: "saved", message: "Saved." };
}

async function deleteChild(table: ChildTable, action: string, formData: FormData): Promise<void> {
  const { anchor, page } = CHILD_TABLES[table];
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  const id = uuidField(formData, "id");
  if (!planId) redirect(adminPath(locale, "/kvk"));
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(editorPath(locale, planId, anchor, "error=forbidden", page));
  if (id) {
    const log = await actionLogger();
    const { error } = await createAdminClient().from(table).delete().eq("id", id).eq("plan_id", planId);
    if (error) {
      log.error(`Deleting from ${table} failed`, { id, error: error.message });
      redirect(editorPath(locale, planId, anchor, "error=delete", page));
    }
    await audit(access.user, action, table, id, { planId });
    updateTag(CACHE_TAGS.kvk);
  }
  redirect(editorPath(locale, planId, anchor, undefined, page));
}

async function existingLocalized(table: string, id: string | null, column: string): Promise<Localized | null> {
  if (!id) return null;
  const { data } = await createAdminClient().from(table).select(column).eq("id", id).maybeSingle();
  const value = (data as Record<string, unknown> | null)?.[column];
  return value && typeof value === "object" ? (value as Localized) : null;
}

export async function saveRule(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const parsed = parseRuleForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  const row = {
    kind: parsed.value.kind,
    text: localizedUpdate(await existingLocalized("kvk_rules", id, "text"), parsed.value.text),
    published: parsed.value.published,
  };
  return saveChild(log, access.user, "kvk_rules", id ? "kvk_rule.update" : "kvk_rule.create", localeField(formData), planId, id, row);
}

export async function deleteRule(formData: FormData): Promise<void> {
  return deleteChild("kvk_rules", "kvk_rule.delete", formData);
}

export async function saveCoordinator(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const { data: alliances } = await createAdminClient().from("alliances").select("tag");
  const parsed = parseCoordinatorForm(formData, (alliances ?? []).map((a) => String(a.tag)));
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  const row = {
    team: parsed.value.team,
    name: parsed.value.name,
    alliance_tag: parsed.value.allianceTag,
    note: localizedUpdate(await existingLocalized("kvk_coordinators", id, "note"), parsed.value.note),
    published: parsed.value.published,
  };
  return saveChild(log, access.user, "kvk_coordinators", id ? "kvk_coordinator.update" : "kvk_coordinator.create", localeField(formData), planId, id, row);
}

export async function deleteCoordinator(formData: FormData): Promise<void> {
  return deleteChild("kvk_coordinators", "kvk_coordinator.delete", formData);
}

export async function saveFormation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const admin = createAdminClient();
  const { data: heroes } = await admin.from("heroes").select("slug");
  const parsed = parseFormationForm(formData, (heroes ?? []).map((h) => String(h.slug)));
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  if (!id) {
    const { count } = await admin.from("kvk_formations").select("id", { count: "exact", head: true }).eq("plan_id", planId);
    if ((count ?? 0) >= MAX_FORMATIONS) {
      return { status: "error", message: `The game has ${MAX_FORMATIONS} preset slots; delete a formation before adding another.` };
    }
  }
  const f = parsed.value;
  const row = {
    label: f.label,
    side: f.side,
    role: f.role,
    hero_1: f.heroes[0],
    hero_2: f.heroes[1],
    hero_3: f.heroes[2],
    infantry_pct: f.infantry,
    cavalry_pct: f.cavalry,
    archers_pct: f.archers,
    note: localizedUpdate(await existingLocalized("kvk_formations", id, "note"), f.note),
    published: f.published,
  };
  return saveChild(log, access.user, "kvk_formations", id ? "kvk_formation.update" : "kvk_formation.create", localeField(formData), planId, id, row);
}

export async function deleteFormation(formData: FormData): Promise<void> {
  return deleteChild("kvk_formations", "kvk_formation.delete", formData);
}

// ---------------------------------------------------------------------------
// Rally-leader page: its brief (own password, instructions) and its rallies
// ---------------------------------------------------------------------------

/** The locked pages next to the battle plan, each with a brief row holding its own password and instructions. */
type BriefArea = Exclude<KvkArea, "plan">;
const BRIEFS: Record<BriefArea, { table: "kvk_leader_briefs" | "kvk_checklist_briefs"; audit: string; name: string }> = {
  leaders: { table: "kvk_leader_briefs", audit: "kvk_leader_brief", name: "Leader page" },
  checklist: { table: "kvk_checklist_briefs", audit: "kvk_checklist_brief", name: "Checklist page" },
};

/**
 * The passwords of the given locked pages of a plan, so a new one never repeats
 * another page's (null where a page has none yet, or its table isn't there
 * before its migration).
 */
async function pagePasswords(planId: string, areas: readonly KvkArea[]): Promise<OtherPasswords> {
  const admin = createAdminClient();
  const entries = await Promise.all(
    areas.map(async (area) => {
      const { data } =
        area === "plan"
          ? await admin.from("kvk_plans").select("password").eq("id", planId).maybeSingle()
          : await admin.from(BRIEFS[area].table).select("password").eq("plan_id", planId).maybeSingle();
      return [area, typeof data?.password === "string" ? data.password : null] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function saveLeaderBrief(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return savePageBrief("leaders", formData);
}

export async function saveChecklistBrief(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return savePageBrief("checklist", formData);
}

/** A locked page's own password (never another page's of the same battle) and its instructions. */
async function savePageBrief(area: BriefArea, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const { table, audit: auditAction, name } = BRIEFS[area];
  const admin = createAdminClient();

  const others = (["plan", "leaders", "checklist"] as const).filter((other) => other !== area);
  const parsed = parsePageBriefForm(formData, await pagePasswords(planId, others));
  if (!parsed.ok) return invalid(parsed.errors);
  const input = parsed.value;

  type ExistingBrief = { id: string; intro: Localized; intro_source: Localized | null };
  const { data: existingRow, error: readError } = await admin.from(table).select("id, intro, intro_source").eq("plan_id", planId).maybeSingle();
  if (readError) return failed(log, `Reading the ${name.toLowerCase()}`, readError);
  const existing = existingRow as ExistingBrief | null;

  // As for the plan intro: a changed English text drops the other languages, the pipeline refills them.
  const intro = localizedUpdate(existing?.intro, markdownToHtml(input.introSource));
  const introSource =
    existing && intro === existing.intro ? { ...(existing.intro_source ?? {}), en: input.introSource } : { en: input.introSource };
  const row = { password: input.password, intro, intro_source: introSource, published: input.published };

  const result = existing
    ? await admin.from(table).update(row).eq("id", existing.id).select("id").single()
    : await admin.from(table).insert({ ...row, plan_id: planId }).select("id").single();
  if (result.error) return failed(log, `Saving the ${name.toLowerCase()}`, result.error);

  await audit(access.user, `${auditAction}.${existing ? "update" : "create"}`, table, String(result.data.id), {
    planId,
    published: input.published,
  });
  expirePlanCaches(locale, planId);
  return { status: "saved", message: `${name} saved.` };
}

export async function saveRallyLeader(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const admin = createAdminClient();
  const [{ data: heroes }, { data: alliances }, { data: plan }] = await Promise.all([
    admin.from("heroes").select("slug"),
    admin.from("alliances").select("tag"),
    admin.from("kvk_plans").select("*").eq("id", planId).maybeSingle(),
  ]);
  // The pets boost must end inside the battle (the standard 12:00–17:00 UTC length while the plan has no times).
  const length = battleMinutes(plan?.battle_at ?? null, plan?.battle_end_at ?? null);
  const parsed = parseRallyLeaderForm(
    formData,
    (heroes ?? []).map((h) => String(h.slug)),
    (alliances ?? []).map((a) => String(a.tag)),
    { latestPetsOffset: latestPetsOffset(length) },
  );
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  const r = parsed.value;
  const row = {
    target: localizedUpdate(await existingLocalized("kvk_rally_leaders", id, "target"), r.target),
    side: r.side,
    team: r.team,
    name: r.name,
    alliance_tag: r.allianceTag,
    position: localizedUpdate(await existingLocalized("kvk_rally_leaders", id, "position"), r.position),
    start_at: r.startAt,
    pets_offset_minutes: r.petsOffsetMinutes,
    hero_1: r.heroes[0],
    hero_2: r.heroes[1],
    hero_3: r.heroes[2],
    infantry_pct: r.infantry,
    cavalry_pct: r.cavalry,
    archers_pct: r.archers,
    note: localizedUpdate(await existingLocalized("kvk_rally_leaders", id, "note"), r.note),
    published: r.published,
  };
  return saveChild(log, access.user, "kvk_rally_leaders", id ? "kvk_rally_leader.update" : "kvk_rally_leader.create", localeField(formData), planId, id, row);
}

export async function deleteRallyLeader(formData: FormData): Promise<void> {
  return deleteChild("kvk_rally_leaders", "kvk_rally_leader.delete", formData);
}

export async function saveLeaderRule(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const parsed = parseLeaderRuleForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  const row = {
    audience: parsed.value.audience,
    kind: parsed.value.kind,
    text: localizedUpdate(await existingLocalized("kvk_leader_rules", id, "text"), parsed.value.text),
    published: parsed.value.published,
  };
  return saveChild(log, access.user, "kvk_leader_rules", id ? "kvk_leader_rule.update" : "kvk_leader_rule.create", localeField(formData), planId, id, row);
}

export async function deleteLeaderRule(formData: FormData): Promise<void> {
  return deleteChild("kvk_leader_rules", "kvk_leader_rule.delete", formData);
}

// ---------------------------------------------------------------------------
// Commander checklist: its items and its commander / guideline lines
// ---------------------------------------------------------------------------

export async function saveChecklistItem(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const parsed = parseChecklistItemForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  const row = {
    phase: parsed.value.phase,
    text: localizedUpdate(await existingLocalized("kvk_checklist_items", id, "text"), parsed.value.text),
    note: localizedUpdate(await existingLocalized("kvk_checklist_items", id, "note"), parsed.value.note),
    published: parsed.value.published,
  };
  return saveChild(log, access.user, "kvk_checklist_items", id ? "kvk_checklist_item.update" : "kvk_checklist_item.create", localeField(formData), planId, id, row);
}

export async function deleteChecklistItem(formData: FormData): Promise<void> {
  return deleteChild("kvk_checklist_items", "kvk_checklist_item.delete", formData);
}

export async function saveChecklistRule(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const planId = uuidField(formData, "planId");
  if (!planId || !(await planExists(planId))) return PLAN_GONE;
  const parsed = parseChecklistRuleForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const id = uuidField(formData, "id");
  const row = {
    section: parsed.value.section,
    kind: parsed.value.kind,
    text: localizedUpdate(await existingLocalized("kvk_checklist_rules", id, "text"), parsed.value.text),
    published: parsed.value.published,
  };
  return saveChild(log, access.user, "kvk_checklist_rules", id ? "kvk_checklist_rule.update" : "kvk_checklist_rule.create", localeField(formData), planId, id, row);
}

export async function deleteChecklistRule(formData: FormData): Promise<void> {
  return deleteChild("kvk_checklist_rules", "kvk_checklist_rule.delete", formData);
}

const MOVE_FAILED = "The row could not be moved. Reload the page and try again.";

/**
 * The ▲ / ▼ arrows next to a row: swaps it with its neighbour and renumbers
 * the list 0…n-1 (which also resolves ties left by older rows). Returns a
 * state instead of redirecting so the editor re-renders in place and the
 * arrows can show a failure.
 */
export async function moveRow(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  const id = uuidField(formData, "id");
  const table = textField(formData, "table");
  const direction = textField(formData, "direction");
  if (!planId || !id || !isChildTable(table) || !isMoveDirection(direction)) return { status: "error", message: MOVE_FAILED };
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();

  const admin = createAdminClient();
  const { data: rows, error } = await admin.from(table).select("id, sort_order").eq("plan_id", planId).order("sort_order").order("created_at");
  if (error) return failed(log, `Reordering ${table}`, error, MOVE_FAILED);
  const ids = (rows ?? []).map((row) => String(row.id));
  const order = moveInList(ids, id, direction);
  if (!order) return { status: "idle" }; // deleted meanwhile, or already at that end: nothing to write
  const current = new Map((rows ?? []).map((row) => [String(row.id), Number(row.sort_order)]));
  // One row after the other: a failure stops the renumbering at a known point instead of leaving a random subset written.
  for (const [index, rowId] of order.entries()) {
    if (current.get(rowId) === index) continue;
    const { error: writeError } = await admin.from(table).update({ sort_order: index }).eq("id", rowId).eq("plan_id", planId);
    if (writeError) return failed(log, `Reordering ${table}`, writeError, MOVE_FAILED);
  }
  await audit(access.user, `${CHILD_TABLES[table].action}.move`, table, id, { planId, direction });
  expirePlanCaches(locale, planId);
  return { status: "saved" };
}

// ---------------------------------------------------------------------------
// Manual corrections of one language (never English, never re-translated)
// ---------------------------------------------------------------------------

export async function saveTranslation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const table = textField(formData, "table");
  const column = textField(formData, "column");
  const lang = textField(formData, "lang");
  const id = uuidField(formData, "id");
  const planId = uuidField(formData, "planId");
  if (!id || !planId || !isEditableTextColumn(table, column)) return { status: "error", message: "Unknown field." };
  if (lang === "en" || !isLocaleCode(lang)) return { status: "error", message: "English is edited in English mode." };
  if (!(await getEnabledLocales()).includes(lang)) return { status: "error", message: "That language is not enabled." };
  const value = textField(formData, "value").slice(0, TEXT_LIMITS[column] ?? 400);

  const admin = createAdminClient();
  const { data: row } = await admin.from(table).select("*").eq("id", id).maybeSingle();
  if (!row) return { status: "error", message: "This row no longer exists." };
  if (pendingColumns(table, row).includes(column)) {
    return { status: "error", message: "The machine translation of this text is still running; try again in a moment." };
  }

  const current = (row[column] ?? {}) as Localized;
  const update: Record<string, unknown> =
    column === "intro" && (table === "kvk_plans" || table === "kvk_retrospectives" || table === "kvk_leader_briefs" || table === "kvk_checklist_briefs")
      ? {
          intro: withLanguage(current, lang, value ? markdownToHtml(value) : ""),
          intro_source: withLanguage((row.intro_source ?? {}) as Localized, lang, value),
        }
      : { [column]: withLanguage(current, lang, value) };
  // source_hash is deliberately left alone: the English is unchanged, so the pipeline skips this row.
  const { error } = await admin.from(table).update(update).eq("id", id);
  if (error) return failed(log, "Saving the translation", error);

  await audit(access.user, "translation.update", table, id, { column, lang, planId });
  expirePlanCaches(locale, planId);
  if (table === "kvk_retrospectives") updateTag(CACHE_TAGS.retro);
  return { status: "saved", message: "Saved for this language only." };
}
