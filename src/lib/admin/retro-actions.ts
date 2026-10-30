"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { CACHE_TAGS } from "@/lib/data";
import { markdownToHtml } from "@/lib/html";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { type Localized, pick } from "@/lib/i18n/localized";
import { elapsedMs, type Logger } from "@/lib/log";
import { getTranslationSettings } from "@/lib/config/settings";
import { retroAiConfigured } from "@/lib/retro/ai";
import { PAUSED_MESSAGE } from "@/lib/translate/pause";
import { translateAndAnalyse, translateResponses } from "@/lib/retro/analyse";
import type { AnalysisContext } from "@/lib/retro/analysis";
import { RATING_QUESTIONS, TEXT_PROMPTS } from "@/lib/retro/questions";
import { parseResultsView, resultsQuery } from "@/lib/retro/results-view";
import { createAdminClient } from "@/lib/supabase/admin";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { feedbackOpenProblem } from "./kvk-forms";
import { introSourceUnchanged, localeField, localizedUpdate, shownIntroSource, uuidField } from "./forms";
import { getRetrospectiveByPlan, listResponses } from "./retro-data";
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
    admin.from("kvk_plans").select("id, slug, active").eq("id", planId).maybeSingle(),
    admin.from("kvk_retrospectives").select("id, title, intro, intro_source, open").eq("plan_id", planId).maybeSingle(),
  ]);
  if (!plan) return PLAN_GONE;
  if (readError) return failed(log, "Reading the retrospective", readError);
  // Players unlock the feedback page with the active plan's password (and the plan stays active while the form is open).
  const openProblem = feedbackOpenProblem(input.open && !existing?.open, Boolean(plan.active));
  if (openProblem) return invalid({ open: openProblem });

  // A changed English text drops the other languages; the pipeline refills them (as for the plan intro).
  const intro =
    existing && introSourceUnchanged(input.introSource, shownIntroSource(existing.intro_source as Localized | null, existing.intro as Localized | null))
      ? (existing.intro as Localized)
      : localizedUpdate((existing?.intro as Localized | null) ?? null, markdownToHtml(input.introSource));
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

  // Only one form can be open (unique partial index). The form is saved first and
  // opened afterwards, so a save that fails never leaves the open form closed.
  const opening = input.open && !existing?.open;
  const result = existing
    ? await admin.from("kvk_retrospectives").update({ ...row, open: input.open && !opening }).eq("id", existing.id).select("id").single()
    : await admin.from("kvk_retrospectives").insert({ ...row, open: false }).select("id").single();
  if (result.error) return failed(log, "Saving the retrospective", result.error);

  const retroId = String(result.data.id);
  if (opening) {
    const { error: closeError } = await admin.from("kvk_retrospectives").update({ open: false }).eq("open", true).neq("id", retroId);
    if (closeError) return failed(log, "Closing the other feedback forms", closeError);
    const { error: openError } = await admin.from("kvk_retrospectives").update({ open: true }).eq("id", retroId);
    if (openError) return failed(log, "Opening the feedback form", openError);
  }
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

/** Removes the stored AI summary, which quotes answers verbatim, once answers are gone. */
async function clearAnalysis(retroId: string, log: Logger): Promise<void> {
  const { error } = await createAdminClient().from("kvk_retrospectives").update({ analysis: null, analysis_at: null, analysis_count: null }).eq("id", retroId);
  if (error) log.error("Clearing the feedback summary failed", { retro: retroId, error: error.message });
}

/** One answer (e.g. abusive text). Moderators and admins. Returns to the page of answers it was on, names hidden if they were. */
export async function deleteResponse(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  const id = uuidField(formData, "id");
  if (!planId) redirect(adminPath(locale, "/feedback"));
  const view = resultsQuery(parseResultsView(formData));
  const back = (notice: string) => resultsPath(locale, planId, view ? `${notice}&${view}` : notice);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(back("error=forbidden"));
  if (id) {
    const log = await actionLogger();
    const admin = createAdminClient();
    // Only an answer of this plan's retrospective: the id alone would reach any plan's answers.
    const { data: retro, error: retroError } = await admin.from("kvk_retrospectives").select("id").eq("plan_id", planId).maybeSingle();
    if (retroError) {
      log.error("Reading the retrospective failed", { planId, error: retroError.message });
      redirect(back("error=delete"));
    }
    if (!retro) redirect(back("error=delete"));
    const { data, error } = await admin.from("kvk_retro_responses").delete().eq("id", id).eq("retrospective_id", retro.id).select("retrospective_id").maybeSingle();
    if (error) {
      log.error("Deleting a feedback response failed", { id, error: error.message });
      redirect(back("error=delete"));
    }
    // The stored summary may quote the deleted answer: it goes too, and the next "Translate and analyse" writes a fresh one.
    if (data?.retrospective_id) await clearAnalysis(String(data.retrospective_id), log);
    await audit(access.user, "retro.delete_response", "kvk_retro_responses", id, { planId, retroId: data?.retrospective_id ?? null });
  }
  redirect(back("deleted=1"));
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
  const { data: retro, error: retroError } = await admin.from("kvk_retrospectives").select("id").eq("plan_id", planId).maybeSingle();
  if (retroError) {
    log.error("Reading the retrospective failed", { planId, error: retroError.message });
    redirect(resultsPath(locale, planId, "error=delete"));
  }
  if (!retro) redirect(adminPath(locale, "/feedback?error=missing"));
  const retroId = String(retro.id);
  const { count } = await admin.from("kvk_retro_responses").select("id", { count: "exact", head: true }).eq("retrospective_id", retroId);
  const { error } = await admin.from("kvk_retro_responses").delete().eq("retrospective_id", retroId);
  if (error) {
    log.error("Deleting all feedback failed", { retro: retroId, error: error.message });
    redirect(resultsPath(locale, planId, "error=delete"));
  }
  await clearAnalysis(retroId, log);
  await audit(access.user, "retro.delete_all", "kvk_retro_responses", retroId, { planId, deleted: count ?? 0, summary: `${count ?? 0} responses deleted` });
  redirect(resultsPath(locale, planId, "cleared=1"));
}

/**
 * "Translate and analyse": translates the texts of every response that has no
 * English version yet (stored per response, never redone), then produces and
 * stores one AI summary over all responses. Moderators and admins; every run
 * is audited with its token usage. Identity never goes to the model: the
 * responses are loaded without it.
 */
/** The summary is the biggest AI request (one call over every answer), so only the owner starts it; everyone sees the stored result. */
const SUMMARY_OWNER_ONLY = "Only the owner runs the AI summary. You can still translate the answers.";

/** "Translate answers": English versions of new written answers only (the small model, cheap); any moderator. */
export async function translateRetrospective(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  if (!planId) return PLAN_GONE;
  if (!retroAiConfigured()) return { status: "error", message: "The AI step is turned off: set ANTHROPIC_API_KEY (or GEMINI_API_KEY) in Vercel." };
  if ((await getTranslationSettings()).paused) return { status: "error", message: PAUSED_MESSAGE };
  const retro = await getRetrospectiveByPlan(planId);
  if (!retro) return { status: "error", message: "This feedback form no longer exists." };
  const responses = await listResponses(retro.id, { identity: false });
  const started = performance.now();
  try {
    const result = await translateResponses(createAdminClient(), responses, { log });
    await audit(access.user, "retro.translate", "kvk_retrospectives", retro.id, {
      slug: retro.plan.slug,
      translated: result.translated.size,
      translationFailures: result.translationFailures,
      requests: result.usage.requests,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      elapsedMs: elapsedMs(started),
      summary: `${result.translated.size} responses translated`,
    });
    revalidatePath(resultsPath(locale, planId));
    const failures = result.translationFailures > 0 ? ` ${result.translationFailures} could not be translated; try again later.` : "";
    return { status: "saved", message: `Translated ${result.translated.size} response${result.translated.size === 1 ? "" : "s"}.${failures}` };
  } catch (error) {
    log.error("Translating the answers failed", { retro: retro.id, error: error instanceof Error ? error.message : String(error), elapsedMs: elapsedMs(started) });
    return { status: "error", message: "Translating failed. Translations already stored are kept; try again in a moment." };
  }
}

export async function analyseRetrospective(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  if (!access.user.isOwner) return { status: "error", message: SUMMARY_OWNER_ONLY };
  const log = await actionLogger();
  const locale = localeField(formData);
  const planId = uuidField(formData, "planId");
  if (!planId) return PLAN_GONE;
  if (!retroAiConfigured()) return { status: "error", message: "The AI step is turned off: set ANTHROPIC_API_KEY (or GEMINI_API_KEY) in Vercel." };
  if ((await getTranslationSettings()).paused) return { status: "error", message: PAUSED_MESSAGE };
  const retro = await getRetrospectiveByPlan(planId);
  if (!retro) return { status: "error", message: "This feedback form no longer exists." };
  const responses = await listResponses(retro.id, { identity: false });
  if (responses.length === 0) return { status: "error", message: "No responses to analyse yet." };

  const en = await getDictionary("en");
  const context: AnalysisContext = {
    title: pick(retro.plan.title, "en") || retro.plan.slug,
    eventType: retro.plan.eventType,
    battleAt: retro.plan.battleAt,
    ratingLabels: Object.fromEntries(RATING_QUESTIONS.map((q) => [q.key, en[q.labelKey]])),
    textLabels: Object.fromEntries(TEXT_PROMPTS.map((t) => [t.key, en[t.labelKey]])),
  };
  const started = performance.now();
  try {
    const result = await translateAndAnalyse(createAdminClient(), { id: retro.id, config: retro.config, context }, responses, { log });
    await audit(access.user, "retro.analyse", "kvk_retrospectives", retro.id, {
      slug: retro.plan.slug,
      analysed: result.analysed,
      translated: result.translated,
      translationFailures: result.translationFailures,
      omittedTexts: result.omittedTexts,
      model: result.analysis.model,
      requests: result.usage.requests,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      elapsedMs: elapsedMs(started),
      summary: `${result.analysed} responses analysed, ${result.translated} translated`,
    });
    revalidatePath(resultsPath(locale, planId));
    const failures = result.translationFailures > 0 ? `; ${result.translationFailures} could not be translated and were read as written` : "";
    return {
      status: "saved",
      message: `Analysed ${result.analysed} responses (${result.translated} newly translated${failures}). Tokens: ${result.usage.inputTokens.toLocaleString("en")} in, ${result.usage.outputTokens.toLocaleString("en")} out.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Translate and analyse failed", { retro: retro.id, error: message, elapsedMs: elapsedMs(started) });
    return { status: "error", message: `The analysis failed: ${message} Translations already stored are kept; try again in a moment.` };
  }
}
