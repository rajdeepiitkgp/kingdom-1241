"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { CACHE_TAGS, routesForTag } from "@/lib/data/cache-tags";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { GONE, NO_DATABASE, uniqueViolation } from "./content-write";
import { localeField, localizedUpdate, slugify, uuidField } from "./forms";
import { parseEventForm } from "./site-forms";

/**
 * Server Actions of the events editor (moderators and up). Every write is
 * audited and expires the events' cache (Home, the events page and the guide
 * pages, which show their events).
 */

const NOT_MIGRATED: ActionState = {
  status: "error",
  message: "Alliance-picked times and second days arrive with a database update that isn't applied yet. Try again in a few minutes.",
};

function eventsChanged(locale: string, path?: string) {
  updateTag(CACHE_TAGS.events);
  for (const route of routesForTag(CACHE_TAGS.events)) revalidatePath(route, "page");
  revalidatePath(adminPath(locale, "/events"));
  if (path) revalidatePath(adminPath(locale, path));
}

/** A column of migration 0022 is missing (the deploy ran ahead of the database). */
function missingColumn(error: { code?: string } | null): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

type ExistingEvent = { name: Localized; summary: Localized; timing?: string };

export async function saveEvent(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const admin = createAdminClient();

  const { data: guides, error: guidesError } = await admin.from("guides").select("slug");
  if (guidesError) return failed(log, "Reading the guides", guidesError);
  const parsed = parseEventForm(formData, { guideSlugs: (guides ?? []).map((guide) => String(guide.slug)) });
  if (!parsed.ok) return invalid(parsed.errors);
  const input = parsed.value;

  let existing: ExistingEvent | null = null;
  if (id) {
    const { data, error } = await admin.from("events").select("*").eq("id", id).maybeSingle();
    if (error) return failed(log, "Reading the event", error);
    if (!data) return GONE;
    existing = data as ExistingEvent;
  }
  const row: Record<string, unknown> = {
    name: localizedUpdate(existing?.name, input.name),
    summary: localizedUpdate(existing?.summary, input.summary),
    icon: input.icon,
    color: input.color,
    category: input.category,
    guide_slug: input.guideSlug,
    starts_at: input.startsAt,
    duration_minutes: input.durationMinutes,
    repeat_every_days: input.repeatEveryDays,
    published: input.published,
  };
  // The columns of 0022 are written once the database has them, or when the event needs them (then a missing column is reported).
  if ((existing && "timing" in existing) || input.timing !== "fixed" || input.alsoAfterDays !== null) {
    Object.assign(row, { timing: input.timing, also_after_days: input.alsoAfterDays });
  }

  let savedId = id;
  if (id) {
    const { error } = await admin.from("events").update(row).eq("id", id);
    if (missingColumn(error)) return NOT_MIGRATED;
    if (error) return failed(log, "Saving the event", error);
  } else {
    // The slug is the event's name in the database, never shown: a taken one gets a number.
    const base = slugify(input.name) || "event";
    for (let attempt = 1; attempt <= 5 && !savedId; attempt++) {
      const { data, error } = await admin
        .from("events")
        .insert({ ...row, slug: attempt === 1 ? base : `${base}-${attempt}` })
        .select("id")
        .single();
      if (uniqueViolation(error)) continue;
      if (missingColumn(error)) return NOT_MIGRATED;
      if (error) return failed(log, "Adding the event", error);
      savedId = String(data.id);
    }
    if (!savedId) return { status: "error", message: "Another event already has this name. Change the name a little and try again." };
  }

  await audit(access.user, id ? "event.edit" : "event.add", "events", savedId, {
    name: input.name,
    timing: input.timing,
    startsAt: input.startsAt,
    repeatEveryDays: input.repeatEveryDays,
    published: input.published,
  });
  eventsChanged(locale, `/events/${savedId}`);
  if (!id) redirect(adminPath(locale, `/events/${savedId}?created=${input.published ? "live" : "draft"}`));
  return {
    status: "saved",
    message: input.published ? "Saved. Players see it within seconds; other languages follow within a minute." : "Saved as hidden: players don't see this event.",
  };
}

export async function deleteEvent(formData: FormData): Promise<void> {
  const locale = localeField(formData);
  const access = await checkAccess("moderator");
  if ("denied" in access) redirect(adminPath(locale, "/events?error=forbidden"));
  const id = uuidField(formData, "id");
  if (!id) redirect(adminPath(locale, "/events"));
  const log = await actionLogger();
  const { data, error } = await createAdminClient().from("events").delete().eq("id", id).select("name");
  if (error) {
    log.error("Deleting the event failed", { error: error.message, code: error.code });
    redirect(adminPath(locale, "/events?error=delete"));
  }
  if (data?.length) await audit(access.user, "event.delete", "events", id, { name: (data[0].name as Localized | undefined)?.en ?? null });
  eventsChanged(locale);
  redirect(adminPath(locale, "/events?deleted=1"));
}
