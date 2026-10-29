"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, supabaseUrl } from "@/lib/supabase/env";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { parseRuleForm, parseRuleTopicForm } from "./content-forms";
import { bodyColumns, GONE, NO_DATABASE, nextSortOrder, uniqueViolation } from "./content-write";
import { localeField, localizedUpdate, uuidField } from "./forms";

/**
 * Server Actions of the rules page's editor (moderators and up): topics (the
 * tabs of /rules) and the rules inside them. Every write is audited and
 * expires the rules page's cache.
 */

function rulesChanged(locale: string, path?: string) {
  updateTag(CACHE_TAGS.rules);
  revalidatePath(adminPath(locale, "/rules"));
  if (path) revalidatePath(adminPath(locale, path));
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export async function saveRuleTopic(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  const parsed = parseRuleTopicForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const input = parsed.value;
  const admin = createAdminClient();

  let existing: { title: Localized } | null = null;
  if (id) {
    const { data, error } = await admin.from("rule_topics").select("title").eq("id", id).maybeSingle();
    if (error) return failed(log, "Reading the topic", error);
    if (!data) return GONE;
    existing = data as { title: Localized };
  }
  const row: Record<string, unknown> = { title: localizedUpdate(existing?.title, input.title), icon: input.icon, slug: input.slug, published: input.published };
  if (!id) {
    const next = await nextSortOrder(admin, "rule_topics");
    if ("error" in next) return failed(log, "Adding the topic", next.error);
    row.sort_order = next.value;
  }
  const result = id
    ? await admin.from("rule_topics").update(row).eq("id", id).select("id").single()
    : await admin.from("rule_topics").insert(row).select("id").single();
  if (uniqueViolation(result.error)) return invalid({ slug: "Another topic already uses this address. Pick another one." });
  if (result.error) return failed(log, "Saving the topic", result.error);

  const savedId = String(result.data.id);
  await audit(access.user, id ? "rule_topic.edit" : "rule_topic.add", "rule_topics", savedId, { title: input.title, slug: input.slug, published: input.published });
  rulesChanged(locale, `/rules/topics/${savedId}`);
  if (!id) redirect(adminPath(locale, `/rules?created=topic`));
  return { status: "saved", message: input.published ? "Saved. Players see it within seconds; other languages follow within a minute." : "Saved as hidden: players don't see this topic." };
}

export async function deleteRuleTopic(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, "/rules?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/rules"));
  const log = await actionLogger();
  // The topic's rules go with it (on delete cascade).
  const { data, error } = await createAdminClient().from("rule_topics").delete().eq("id", id).select("title, slug");
  if (error) {
    log.error("Deleting the topic failed", { error: error.message, code: error.code });
    redirect(adminPath(locale, "/rules?error=delete"));
  }
  if (data?.length) await audit(access.user, "rule_topic.delete", "rule_topics", id, { title: (data[0].title as Localized | undefined)?.en ?? null, slug: data[0].slug });
  rulesChanged(locale);
  redirect(adminPath(locale, "/rules?deleted=topic"));
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

type ExistingRule = { topic_id: string; title: Localized; body: Localized; body_source?: Localized | null };

export async function saveRule(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  const parsed = parseRuleForm(formData, { supabaseUrl: supabaseUrl() });
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const input = parsed.value;
  const admin = createAdminClient();

  const { data: topic, error: topicError } = await admin.from("rule_topics").select("id").eq("id", input.topicId).maybeSingle();
  if (topicError) return failed(log, "Reading the topic", topicError);
  if (!topic) return invalid({ topicId: "That topic no longer exists. Reload the page." });

  let existing: ExistingRule | null = null;
  if (id) {
    const { data, error } = await admin.from("rules").select("*").eq("id", id).maybeSingle();
    if (error) return failed(log, "Reading the rule", error);
    if (!data) return GONE;
    existing = data as ExistingRule;
  }
  const row: Record<string, unknown> = {
    topic_id: input.topicId,
    title: localizedUpdate(existing?.title, input.title),
    ...bodyColumns(existing, input.bodySource),
    published: input.published,
  };
  // A new rule, or one moved to another topic, goes to the end of that topic.
  if (!existing || existing.topic_id !== input.topicId) {
    const next = await nextSortOrder(admin, "rules", { column: "topic_id", value: input.topicId });
    if ("error" in next) return failed(log, "Adding the rule", next.error);
    row.sort_order = next.value;
  }
  const result = id ? await admin.from("rules").update(row).eq("id", id).select("id").single() : await admin.from("rules").insert(row).select("id").single();
  if (result.error) return failed(log, "Saving the rule", result.error);

  const savedId = String(result.data.id);
  await audit(access.user, id ? "rule.edit" : "rule.add", "rules", savedId, { title: input.title, topicId: input.topicId, published: input.published });
  rulesChanged(locale, `/rules/${savedId}`);
  if (!id) redirect(adminPath(locale, `/rules/${savedId}?created=${input.published ? "live" : "draft"}`));
  return { status: "saved", message: input.published ? "Saved. Players see it within seconds; other languages follow within a minute." : "Saved as hidden: players don't see this rule." };
}

export async function deleteRule(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, "/rules?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/rules"));
  const log = await actionLogger();
  const { data, error } = await createAdminClient().from("rules").delete().eq("id", id).select("title");
  if (error) {
    log.error("Deleting the rule failed", { error: error.message, code: error.code });
    redirect(adminPath(locale, "/rules?error=delete"));
  }
  if (data?.length) await audit(access.user, "rule.delete", "rules", id, { title: (data[0].title as Localized | undefined)?.en ?? null });
  rulesChanged(locale);
  redirect(adminPath(locale, "/rules?deleted=rule"));
}
