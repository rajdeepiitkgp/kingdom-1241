"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { CACHE_TAGS } from "@/lib/data";
import { markdownToHtml } from "@/lib/html";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField, localizedUpdate, uuidField } from "./forms";
import { parseRetroSettingsForm } from "./retro-forms";

/**
 * Server Actions of the battle retrospective: the settings in the plan editor
 * (moderators) and the deletion of answers (one: moderators; all: admins).
 * Every action re-checks the role, writes with the service role, logs to the
 * audit table (counts and ids, never a player's text) and expires the public
 * feedback page.
 */

const PLAN_GONE: ActionState = { status: "error", message: "This plan no longer exists." };

function resultsPath(locale: string, planId: string, query?: string): string {
  return adminPath(locale, `/feedback/${planId}${query ? `?${query}` : ""}`);
}

export async function saveRetrospective(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  if (!planId) return PLAN_GONE;
  const parsed = parseRetroSettingsForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  const input = parsed.value;

  const admin = createAdminClient();
  const [{ data: plan }, { data: existing, error: readError }] = await Promise.all([
    admin.from("kvk_plans").select("id, slug").eq("id", planId).maybeSingle(),
    admin.from("kvk_retrospectives").select("id, title, intro, intro_source").eq("plan_id", planId).maybeSingle(),
  ]);
  if (!plan) return PLAN_GONE;
  if (readError) return failed(log, "Reading the retrospective", readError);

  // A changed English text drops the other languages; the pipeline refills them (as for the plan intro).
  const intro = localizedUpdate((existing?.intro as Localized | null) ?? null, markdownToHtml(input.introSource));
  const introSource: Localized =
    existing && intro === existing.intro ? { ...((existing.intro_source as Localized | null) ?? {}), en: input.introSource } : { en: input.introSource };
  const row = {
    plan_id: planId,
    open: input.open,
    title: localizedUpdate((existing?.title as Localized | null) ?? null, input.title),
    intro,
    intro_source: introSource,
    config: input.config,
    closes_at: input.closesAt,
    max_responses: input.maxResponses,
    retention_days: input.retentionDays,
  };

  if (input.open) {
    // Only one form can be open (unique partial index): close the others first.
    const { error } = await admin.from("kvk_retrospectives").update({ open: false }).eq("open", true).neq("plan_id", planId);
    if (error) return failed(log, "Closing the other feedback forms", error);
  }

  const result = existing
    ? await admin.from("kvk_retrospectives").update(row).eq("id", existing.id).select("id").single()
    : await admin.from("kvk_retrospectives").insert(row).select("id").single();
  if (result.error) return failed(log, "Saving the retrospective", result.error);

  const retroId = String(result.data.id);
  await audit(access.user, existing ? "retro.update" : "retro.create", "kvk_retrospectives", retroId, {
    slug: String(plan.slug),
    open: input.open,
    maxResponses: input.maxResponses,
    retentionDays: input.retentionDays,
    closesAt: input.closesAt,
  });
  updateTag(CACHE_TAGS.retro);
  revalidatePath(adminPath(locale, `/kvk/${planId}`));
  revalidatePath(resultsPath(locale, planId));
  return { status: "saved", message: input.open ? "Saved. The feedback form is open for players." : "Saved. The feedback form is closed." };
}

/** One answer (e.g. abusive text). Moderators and admins. */
export async function deleteResponse(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  const id = uuidField(formData, "id");
  if (!planId) redirect(adminPath(locale, "/feedback"));
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(resultsPath(locale, planId, "error=forbidden"));
  if (id) {
    const log = await actionLogger();
    const { data, error } = await createAdminClient().from("kvk_retro_responses").delete().eq("id", id).select("retrospective_id").maybeSingle();
    if (error) {
      log.error("Deleting a feedback response failed", { id, error: error.message });
      redirect(resultsPath(locale, planId, "error=delete"));
    }
    await audit(access.user, "retro.delete_response", "kvk_retro_responses", id, { planId, retroId: data?.retrospective_id ?? null });
  }
  redirect(resultsPath(locale, planId, "deleted=1"));
}

/** Every answer of a battle. Administrators only; the page asks for an export first. */
export async function deleteAllResponses(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  if (!planId) redirect(adminPath(locale, "/feedback"));
  const access = await checkAccess("admin");
  if ("denied" in access) redirect(resultsPath(locale, planId, "error=forbidden"));
  const log = await actionLogger();

  const admin = createAdminClient();
  const { data: retro } = await admin.from("kvk_retrospectives").select("id").eq("plan_id", planId).maybeSingle();
  if (!retro) redirect(adminPath(locale, "/feedback?error=missing"));
  const retroId = String(retro.id);
  const { count } = await admin.from("kvk_retro_responses").select("id", { count: "exact", head: true }).eq("retrospective_id", retroId);
  const { error } = await admin.from("kvk_retro_responses").delete().eq("retrospective_id", retroId);
  if (error) {
    log.error("Deleting all feedback failed", { retro: retroId, error: error.message });
    redirect(resultsPath(locale, planId, "error=delete"));
  }
  await audit(access.user, "retro.delete_all", "kvk_retro_responses", retroId, { planId, deleted: count ?? 0, summary: `${count ?? 0} responses deleted` });
  redirect(resultsPath(locale, planId, "cleared=1"));
}
