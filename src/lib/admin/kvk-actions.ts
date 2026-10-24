"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess, type AccessDenial, type CurrentUser } from "@/lib/auth/server";
import { CACHE_TAGS, getEnabledLocales } from "@/lib/data";
import { markdownToHtml } from "@/lib/html";
import type { Localized } from "@/lib/i18n/localized";
import { createLogger } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localizedUpdate, textField } from "./forms";
import { isMoveDirection, MAX_FORMATIONS, moveInList, parseCoordinatorForm, parseFormationForm, parsePlanForm, parseRuleForm } from "./kvk-forms";
import { isEditableTextColumn, pendingColumns, TEXT_LIMITS, withLanguage } from "./translation";

/**
 * Server Actions of the battle-plan editor. Every action re-checks the role
 * (these are reachable by a direct POST), writes with the service role, logs
 * to the audit table and expires the public page cache (`content:kvk`), so
 * players see the change on their next request.
 */

const log = createLogger("admin");
const UUID = /^[0-9a-f-]{36}$/i;

function denied(reason: AccessDenial): ActionState {
  return {
    status: "error",
    message: reason === "signed_out" ? "Your session has ended. Sign in again." : "You don't have permission for this.",
  };
}

function failed(what: string, error: { message: string; code?: string }): ActionState {
  log.error(`${what} failed`, { error: error.message, code: error.code });
  return { status: "error", message: "Saving failed. Try again in a moment." };
}

function localeField(formData: FormData): string {
  const value = textField(formData, "locale");
  return /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(value) ? value : "en";
}

function idField(formData: FormData, name: string): string | null {
  const value = textField(formData, name);
  return UUID.test(value) ? value : null;
}

function editorPath(locale: string, planId: string, anchor?: string): string {
  return adminPath(locale, `/kvk/${planId}${anchor ? `#${anchor}` : ""}`);
}

async function expirePublicPlan(locale: string, planId: string) {
  updateTag(CACHE_TAGS.kvk);
  revalidatePath(editorPath(locale, planId));
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function savePlan(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const locale = localeField(formData);
  const id = idField(formData, "id");
  const admin = createAdminClient();

  type ExistingPlan = { title: Localized; intro: Localized; intro_source: Localized | null; battle_at: string | null };
  let existing: ExistingPlan | null = null;
  if (id) {
    const { data } = await admin.from("kvk_plans").select("title, intro, intro_source, battle_at").eq("id", id).maybeSingle();
    if (!data) return { status: "error", message: "This plan no longer exists." };
    existing = data as ExistingPlan;
  }

  // A changed battle time must lie ahead; an old plan keeps its past time untouched.
  const parsed = parsePlanForm(formData, { now: new Date(), previousBattleAt: existing?.battle_at ?? null });
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Please fix the highlighted fields." };
  const input = parsed.value;

  // A changed English intro drops the other languages (HTML and Markdown sources alike);
  // the pipeline refills the HTML, and sources are re-derived from it when edited.
  const intro = localizedUpdate(existing?.intro, markdownToHtml(input.introSource));
  const introSource =
    existing && intro === existing.intro ? { ...(existing.intro_source ?? {}), en: input.introSource } : { en: input.introSource };

  const row = {
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

  if (input.active) {
    // Only one plan can be active (unique partial index): switch the others off first.
    let deactivate = admin.from("kvk_plans").update({ active: false }).eq("active", true);
    if (id) deactivate = deactivate.neq("id", id);
    const { error } = await deactivate;
    if (error) return failed("Deactivating other plans", error);
  }

  const result = id
    ? await admin.from("kvk_plans").update(row).eq("id", id).select("id").single()
    : await admin.from("kvk_plans").insert(row).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") {
      return { status: "error", errors: { slug: "Another plan already uses this slug." }, message: "Please fix the highlighted fields." };
    }
    return failed("Saving the plan", result.error);
  }

  const planId = String(result.data.id);
  await audit(access.user, id ? "kvk_plan.update" : "kvk_plan.create", "kvk_plans", planId, {
    slug: input.slug,
    active: input.active,
    published: input.published,
  });
  await expirePublicPlan(locale, planId);
  if (!id) redirect(editorPath(locale, planId));
  return { status: "saved", message: "Plan saved." };
}

export async function deletePlan(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("admin");
  if ("denied" in access) redirect(adminPath(locale, "/kvk?error=forbidden"));
  const id = idField(formData, "id");
  if (!id) redirect(adminPath(locale, "/kvk"));

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
  const id = idField(formData, "id");
  if (!id) redirect(adminPath(locale, "/kvk"));

  const admin = createAdminClient();
  const { data: plan, error } = await admin.from("kvk_plans").select("*").eq("id", id).maybeSingle();
  if (error || !plan) redirect(adminPath(locale, "/kvk?error=missing"));

  const copyTitle = `Copy of ${String((plan.title as Localized)?.en ?? plan.slug)}`.slice(0, 120);
  const { id: _oldId, created_at: _c, updated_at: _u, source_hash: _h, ...rest } = plan as Record<string, unknown>;
  void _oldId; void _c; void _u; void _h;
  const copy = await admin
    .from("kvk_plans")
    // The copy starts without a battle time: the next battle's date is always new.
    .insert({ ...rest, slug: `${String(plan.slug)}-copy-${Date.now().toString(36)}`.slice(0, 80), title: { en: copyTitle }, battle_at: null, active: false, published: false })
    .select("id")
    .single();
  if (copy.error) {
    log.error("Duplicating the plan failed", { id, error: copy.error.message });
    redirect(adminPath(locale, "/kvk?error=duplicate"));
  }
  const newId = String(copy.data.id);

  for (const table of ["kvk_rules", "kvk_coordinators", "kvk_formations"] as const) {
    const { data: rows } = await admin.from(table).select("*").eq("plan_id", id);
    if (!rows || rows.length === 0) continue;
    const copies = rows.map((row) => {
      const { id: _rid, created_at: _rc, updated_at: _ru, source_hash: _rh, ...fields } = row as Record<string, unknown>;
      void _rid; void _rc; void _ru; void _rh;
      return { ...fields, plan_id: newId };
    });
    const { error: copyError } = await admin.from(table).insert(copies);
    if (copyError) log.error("Copying plan rows failed", { table, from: id, to: newId, error: copyError.message });
  }

  await audit(access.user, "kvk_plan.duplicate", "kvk_plans", newId, { from: id });
  redirect(editorPath(locale, newId));
}

// ---------------------------------------------------------------------------
// Child rows: rules, coordinators, formations
// ---------------------------------------------------------------------------

type ChildTable = "kvk_rules" | "kvk_coordinators" | "kvk_formations";
const CHILD_TABLES: Record<ChildTable, { anchor: string; action: string }> = {
  kvk_rules: { anchor: "rules", action: "kvk_rule" },
  kvk_coordinators: { anchor: "coordinators", action: "kvk_coordinator" },
  kvk_formations: { anchor: "formations", action: "kvk_formation" },
};

function isChildTable(value: string): value is ChildTable {
  return value in CHILD_TABLES;
}

async function planExists(planId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("kvk_plans").select("id").eq("id", planId).maybeSingle();
  return Boolean(data);
}

/** New rows go to the end of their list; admins reorder with the arrows (moveRow), never by typing numbers. */
async function nextSortOrder(table: ChildTable, planId: string): Promise<number> {
  const { data } = await createAdminClient()
    .from(table)
    .select("sort_order")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return typeof data?.sort_order === "number" ? data.sort_order + 1 : 0;
}

async function saveChild(
  user: CurrentUser,
  table: ChildTable,
  action: string,
  locale: string,
  planId: string,
  id: string | null,
  row: Record<string, unknown>,
  anchor: string,
): Promise<ActionState> {
  const admin = createAdminClient();
  const result = id
    ? await admin.from(table).update(row).eq("id", id).eq("plan_id", planId).select("id").single()
    : await admin.from(table).insert({ ...row, plan_id: planId, sort_order: await nextSortOrder(table, planId) }).select("id").single();
  if (result.error) {
    if (result.error.code === "23505") {
      return { status: "error", errors: { label: "This preset letter is already used in this plan." }, message: "Please fix the highlighted fields." };
    }
    return failed(`Saving ${table}`, result.error);
  }
  await audit(user, action, table, String(result.data.id), { planId });
  updateTag(CACHE_TAGS.kvk);
  revalidatePath(editorPath(locale, planId, anchor));
  return { status: "saved", message: "Saved." };
}

async function deleteChild(
  table: ChildTable,
  action: string,
  anchor: string,
  formData: FormData,
): Promise<void> {
  const locale = localeField(formData);
  const planId = idField(formData, "planId");
  const id = idField(formData, "id");
  if (!planId) redirect(adminPath(locale, "/kvk"));
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(editorPath(locale, planId, anchor));
  if (id) {
    const { error } = await createAdminClient().from(table).delete().eq("id", id).eq("plan_id", planId);
    if (error) log.error(`Deleting from ${table} failed`, { id, error: error.message });
    else await audit(access.user, action, table, id, { planId });
    updateTag(CACHE_TAGS.kvk);
  }
  redirect(editorPath(locale, planId, anchor));
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
  const planId = idField(formData, "planId");
  if (!planId || !(await planExists(planId))) return { status: "error", message: "This plan no longer exists." };
  const parsed = parseRuleForm(formData);
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = idField(formData, "id");
  const row = {
    kind: parsed.value.kind,
    text: localizedUpdate(await existingLocalized("kvk_rules", id, "text"), parsed.value.text),
    published: parsed.value.published,
  };
  return saveChild(access.user, "kvk_rules", id ? "kvk_rule.update" : "kvk_rule.create", localeField(formData), planId, id, row, "rules");
}

export async function deleteRule(formData: FormData): Promise<void> {
  return deleteChild("kvk_rules", "kvk_rule.delete", "rules", formData);
}

export async function saveCoordinator(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const planId = idField(formData, "planId");
  if (!planId || !(await planExists(planId))) return { status: "error", message: "This plan no longer exists." };
  const { data: alliances } = await createAdminClient().from("alliances").select("tag");
  const parsed = parseCoordinatorForm(formData, (alliances ?? []).map((a) => String(a.tag)));
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = idField(formData, "id");
  const row = {
    team: parsed.value.team,
    name: parsed.value.name,
    alliance_tag: parsed.value.allianceTag,
    note: localizedUpdate(await existingLocalized("kvk_coordinators", id, "note"), parsed.value.note),
    published: parsed.value.published,
  };
  return saveChild(access.user, "kvk_coordinators", id ? "kvk_coordinator.update" : "kvk_coordinator.create", localeField(formData), planId, id, row, "coordinators");
}

export async function deleteCoordinator(formData: FormData): Promise<void> {
  return deleteChild("kvk_coordinators", "kvk_coordinator.delete", "coordinators", formData);
}

export async function saveFormation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const planId = idField(formData, "planId");
  if (!planId || !(await planExists(planId))) return { status: "error", message: "This plan no longer exists." };
  const admin = createAdminClient();
  const { data: heroes } = await admin.from("heroes").select("slug");
  const parsed = parseFormationForm(formData, (heroes ?? []).map((h) => String(h.slug)));
  if (!parsed.ok) return { status: "error", errors: parsed.errors, message: "Please fix the highlighted fields." };
  const id = idField(formData, "id");
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
  return saveChild(access.user, "kvk_formations", id ? "kvk_formation.update" : "kvk_formation.create", localeField(formData), planId, id, row, "formations");
}

export async function deleteFormation(formData: FormData): Promise<void> {
  return deleteChild("kvk_formations", "kvk_formation.delete", "formations", formData);
}

/**
 * The ▲ / ▼ arrows next to a row: swaps it with its neighbour and renumbers
 * the list 0…n-1 (which also resolves ties left by older rows). Returns
 * without a redirect so the editor re-renders in place.
 */
export async function moveRow(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const planId = idField(formData, "planId");
  const id = idField(formData, "id");
  const table = textField(formData, "table");
  const direction = textField(formData, "direction");
  if (!planId || !id || !isChildTable(table) || !isMoveDirection(direction)) return;
  const access = await checkAccess("moderator");
  if ("denied" in access) return;

  const admin = createAdminClient();
  const { data: rows, error } = await admin.from(table).select("id, sort_order").eq("plan_id", planId).order("sort_order").order("created_at");
  if (error) {
    log.error(`Reordering ${table} failed`, { planId, error: error.message });
    return;
  }
  const ids = (rows ?? []).map((row) => String(row.id));
  const order = moveInList(ids, id, direction);
  if (!order) return; // unknown row, or already at that end
  const current = new Map((rows ?? []).map((row) => [String(row.id), Number(row.sort_order)]));
  const writes = order.map((rowId, index) => ({ rowId, index })).filter(({ rowId, index }) => current.get(rowId) !== index);
  const results = await Promise.all(
    writes.map(({ rowId, index }) => admin.from(table).update({ sort_order: index }).eq("id", rowId).eq("plan_id", planId)),
  );
  const failure = results.find((result) => result.error)?.error;
  if (failure) log.error(`Reordering ${table} failed`, { planId, error: failure.message });
  await audit(access.user, `${CHILD_TABLES[table].action}.move`, table, id, { planId, direction });
  updateTag(CACHE_TAGS.kvk);
  revalidatePath(editorPath(locale, planId, CHILD_TABLES[table].anchor));
}

// ---------------------------------------------------------------------------
// Manual corrections of one language (never English, never re-translated)
// ---------------------------------------------------------------------------

export async function saveTranslation(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const locale = localeField(formData);
  const table = textField(formData, "table");
  const column = textField(formData, "column");
  const lang = textField(formData, "lang");
  const id = idField(formData, "id");
  const planId = idField(formData, "planId");
  if (!id || !planId || !isEditableTextColumn(table, column)) return { status: "error", message: "Unknown field." };
  if (lang === "en" || !/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(lang)) return { status: "error", message: "English is edited in English mode." };
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
    table === "kvk_plans" && column === "intro"
      ? {
          intro: withLanguage(current, lang, value ? markdownToHtml(value) : ""),
          intro_source: withLanguage((row.intro_source ?? {}) as Localized, lang, value),
        }
      : { [column]: withLanguage(current, lang, value) };
  // source_hash is deliberately left alone: the English is unchanged, so the pipeline skips this row.
  const { error } = await admin.from(table).update(update).eq("id", id);
  if (error) return failed("Saving the translation", error);

  await audit(access.user, "translation.update", table, id, { column, lang, planId });
  updateTag(CACHE_TAGS.kvk);
  revalidatePath(editorPath(locale, planId));
  return { status: "saved", message: "Saved for this language only." };
}
