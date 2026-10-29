"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { missingTable } from "@/lib/content/image-store";
import { getAlliances } from "@/lib/data";
import { CACHE_TAGS, routesForTag } from "@/lib/data/cache-tags";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured, supabaseUrl } from "@/lib/supabase/env";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { parseGuideForm, parseGuideSectionForm } from "./content-forms";
import { bodyColumns, GONE, NO_DATABASE, nextSortOrder, uniqueViolation } from "./content-write";
import { localeField, localizedUpdate, uuidField } from "./forms";

/**
 * Server Actions of the guides' editor (moderators and up): the guides and
 * their alliance sections (how one alliance plays the event; any moderator
 * edits any alliance's section). Every write is audited and expires the
 * guides' cache.
 */

const NOT_MIGRATED: ActionState = { status: "error", message: "Alliance sections arrive with a database update that isn't applied yet. Try again in a few minutes." };

function guidesChanged(locale: string, path?: string) {
  updateTag(CACHE_TAGS.guides);
  // The guide pages need their route expired too, or the first visit shows the previous version.
  for (const route of routesForTag(CACHE_TAGS.guides)) revalidatePath(route, "page");
  revalidatePath(adminPath(locale, "/guides"));
  if (path) revalidatePath(adminPath(locale, path));
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

type ExistingGuide = { slug: string; title: Localized; summary: Localized; body: Localized; body_source?: Localized | null };

export async function saveGuide(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  const parsed = parseGuideForm(formData, { supabaseUrl: supabaseUrl() });
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const input = parsed.value;
  const admin = createAdminClient();

  let existing: ExistingGuide | null = null;
  if (id) {
    const { data, error } = await admin.from("guides").select("*").eq("id", id).maybeSingle();
    if (error) return failed(log, "Reading the guide", error);
    if (!data) return GONE;
    existing = data as ExistingGuide;
  }
  const row: Record<string, unknown> = {
    title: localizedUpdate(existing?.title, input.title),
    summary: localizedUpdate(existing?.summary, input.summary),
    ...bodyColumns(existing, input.bodySource),
    icon: input.icon,
    slug: input.slug,
    published: input.published,
  };
  if (!id) {
    const next = await nextSortOrder(admin, "guides");
    if ("error" in next) return failed(log, "Adding the guide", next.error);
    row.sort_order = next.value;
  }
  const result = id ? await admin.from("guides").update(row).eq("id", id).select("id").single() : await admin.from("guides").insert(row).select("id").single();
  if (uniqueViolation(result.error)) return invalid({ slug: "Another guide already uses this address. Pick another one." });
  if (result.error) return failed(log, "Saving the guide", result.error);

  // Events link to their guide by its address: a new address takes them along.
  if (existing && existing.slug !== input.slug) {
    const { error: eventsError } = await admin.from("events").update({ guide_slug: input.slug }).eq("guide_slug", existing.slug);
    if (eventsError) log.error("Moving the events' guide links failed", { error: eventsError.message, code: eventsError.code });
    updateTag(CACHE_TAGS.events);
  }

  const savedId = String(result.data.id);
  await audit(access.user, id ? "guide.edit" : "guide.add", "guides", savedId, {
    title: input.title,
    slug: input.slug,
    ...(existing && existing.slug !== input.slug ? { previousSlug: existing.slug } : {}),
    published: input.published,
  });
  guidesChanged(locale, `/guides/${savedId}`);
  if (!id) redirect(adminPath(locale, `/guides/${savedId}?created=${input.published ? "live" : "draft"}`));
  return { status: "saved", message: input.published ? "Saved. Players see it within seconds; other languages follow within a minute." : "Saved as hidden: players don't see this guide." };
}

export async function deleteGuide(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, "/guides?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/guides"));
  const log = await actionLogger();
  const admin = createAdminClient();
  // The alliance sections go with the guide (on delete cascade).
  const { data, error } = await admin.from("guides").delete().eq("id", id).select("title, slug");
  if (error) {
    log.error("Deleting the guide failed", { error: error.message, code: error.code });
    redirect(adminPath(locale, "/guides?error=delete"));
  }
  if (data?.length) {
    const slug = String(data[0].slug);
    // An event must not link to a guide that is gone.
    const { error: eventsError } = await admin.from("events").update({ guide_slug: null }).eq("guide_slug", slug);
    if (eventsError) log.error("Removing the events' guide links failed", { error: eventsError.message, code: eventsError.code });
    updateTag(CACHE_TAGS.events);
    await audit(access.user, "guide.delete", "guides", id, { title: (data[0].title as Localized | undefined)?.en ?? null, slug });
  }
  guidesChanged(locale);
  redirect(adminPath(locale, "/guides?deleted=1"));
}

// ---------------------------------------------------------------------------
// Alliance sections
// ---------------------------------------------------------------------------

type ExistingSection = { alliance_tag: string; body: Localized; body_source?: Localized | null };

export async function saveGuideSection(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const guideId = uuidField(formData, "guideId");
  const id = uuidField(formData, "id");
  if (!guideId) return GONE;
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const admin = createAdminClient();

  const { data: guide, error: guideError } = await admin.from("guides").select("id").eq("id", guideId).maybeSingle();
  if (guideError) return failed(log, "Reading the guide", guideError);
  if (!guide) return GONE;

  let existing: ExistingSection | null = null;
  let taken: string[] = [];
  if (id) {
    const { data, error } = await admin.from("guide_sections").select("*").eq("id", id).eq("guide_id", guideId).maybeSingle();
    if (missingTable(error)) return NOT_MIGRATED;
    if (error) return failed(log, "Reading the alliance section", error);
    if (!data) return GONE;
    existing = data as ExistingSection;
  } else {
    const { data, error } = await admin.from("guide_sections").select("alliance_tag").eq("guide_id", guideId);
    if (missingTable(error)) return NOT_MIGRATED;
    if (error) return failed(log, "Reading the alliance sections", error);
    taken = (data ?? []).map((row) => String(row.alliance_tag));
  }
  const alliances = id ? [] : await getAlliances();
  const parsed = parseGuideSectionForm(formData, { supabaseUrl: supabaseUrl(), isNew: !id, allianceTags: alliances.map((a) => a.tag), taken });
  if (!parsed.ok) return invalid(parsed.errors);
  const input = parsed.value;

  const row: Record<string, unknown> = { ...bodyColumns(existing, input.bodySource), published: input.published };
  if (!id) Object.assign(row, { guide_id: guideId, alliance_tag: input.allianceTag });
  const result = id
    ? await admin.from("guide_sections").update(row).eq("id", id).select("id").single()
    : await admin.from("guide_sections").insert(row).select("id").single();
  if (uniqueViolation(result.error)) return invalid({ allianceTag: "This alliance already has a section in this guide: edit that one." });
  if (missingTable(result.error)) return NOT_MIGRATED;
  if (result.error) return failed(log, "Saving the alliance section", result.error);

  const savedId = String(result.data.id);
  const allianceTag = existing?.alliance_tag ?? input.allianceTag;
  await audit(access.user, id ? "guide_section.edit" : "guide_section.add", "guide_sections", savedId, { guideId, allianceTag, published: input.published });
  guidesChanged(locale, `/guides/${guideId}`);
  if (!id) redirect(adminPath(locale, `/guides/${guideId}/alliances/${savedId}?created=${input.published ? "live" : "draft"}`));
  return { status: "saved", message: input.published ? "Saved. Players see it within seconds; other languages follow within a minute." : "Saved as hidden: players don't see this section." };
}

export async function deleteGuideSection(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const guideId = uuidField(formData, "guideId");
  const back = guideId ? `/guides/${guideId}` : "/guides";
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, `${back}?error=forbidden`));
  const id = uuidField(formData, "id");
  if (!id || !guideId) redirect(adminPath(locale, back));
  const log = await actionLogger();
  const { data, error } = await createAdminClient().from("guide_sections").delete().eq("id", id).eq("guide_id", guideId).select("alliance_tag");
  if (error) {
    log.error("Deleting the alliance section failed", { error: error.message, code: error.code });
    redirect(adminPath(locale, `${back}?error=delete`));
  }
  if (data?.length) await audit(access.user, "guide_section.delete", "guide_sections", id, { guideId, allianceTag: data[0].alliance_tag });
  guidesChanged(locale, back);
  redirect(adminPath(locale, `${back}?deleted=section`));
}
