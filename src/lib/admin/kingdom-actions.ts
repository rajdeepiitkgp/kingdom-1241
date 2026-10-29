"use server";

import { revalidatePath, updateTag } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkAccess } from "@/lib/auth/server";
import { CACHE_TAGS, routesForTag } from "@/lib/data/cache-tags";
import type { Localized } from "@/lib/i18n/localized";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { hasTransferTerms } from "@/lib/transfers/terms";
import { actionLogger, denied, failed, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { bodyColumns, GONE, NO_DATABASE } from "./content-write";
import { localeField, localizedUpdate, uuidField } from "./forms";
import { parseAllianceProfileForm, parseTransfersForm } from "./site-forms";

/**
 * Server Actions of the alliance pages (any moderator writes what an
 * alliance's R5s say about it; the list and the numbers stay the owner's and
 * MightPulse's) and of the transfer section (administrators). Every save is
 * audited.
 */

export async function saveAllianceProfile(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const id = uuidField(formData, "id");
  if (!id) return GONE;
  const parsed = parseAllianceProfileForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const input = parsed.value;
  const admin = createAdminClient();

  const { data: existing, error: readError } = await admin.from("alliances").select("tag, description, requirements").eq("id", id).maybeSingle();
  if (readError) return failed(log, "Reading the alliance", readError);
  if (!existing) return GONE;
  const { error } = await admin
    .from("alliances")
    .update({
      description: localizedUpdate(existing.description as Localized, input.description),
      requirements: localizedUpdate(existing.requirements as Localized, input.requirements),
      languages: input.languages,
      discord_url: input.discordUrl,
    })
    .eq("id", id);
  if (error) return failed(log, "Saving the alliance page", error);

  await audit(access.user, "alliance.page_edit", "alliances", id, { tag: existing.tag, discord: Boolean(input.discordUrl) });
  updateTag(CACHE_TAGS.alliances);
  for (const route of routesForTag(CACHE_TAGS.alliances)) revalidatePath(route, "page");
  revalidatePath(adminPath(locale, "/alliances"));
  revalidatePath(adminPath(locale, `/alliances/${id}`));
  return { status: "saved", message: "Saved. Players see it within seconds; other languages follow within a minute." };
}

/** The kingdom's Discord, and the transfer section: open or closed, the game's terms, its two texts and its own Discord (rows of `site_settings`). Administrators only. */
export async function saveTransfers(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkAccess("admin");
  if ("denied" in access) return denied(access.denied);
  const log = await actionLogger();
  const locale = localeField(formData);
  const parsed = parseTransfersForm(formData);
  if (!parsed.ok) return invalid(parsed.errors);
  if (!isSupabaseAdminConfigured()) return NO_DATABASE;
  const input = parsed.value;
  const admin = createAdminClient();

  const { data: rows, error: readError } = await admin.from("site_settings").select("key, value").in("key", ["transfers_open", "transfer_info", "transfer_contact"]);
  if (readError) return failed(log, "Reading the transfer settings", readError);
  const current = (key: string) => (rows ?? []).find((row) => row.key === key)?.value as Localized | boolean | undefined;
  const wasOpen = current("transfers_open") === true;
  const asText = (value: Localized | boolean | undefined) => (value && typeof value === "object" ? value : undefined);
  // Rich text: the Markdown is stored as HTML, like every content text (the editor opens it through htmlToMarkdown).
  const richText = (key: string, markdown: string) => {
    const stored = asText(current(key));
    return bodyColumns(stored ? { body: stored } : null, markdown).body;
  };
  // One row per key: the texts keep their translations while the English is unchanged (the pipeline refills the rest).
  const { error } = await admin.from("site_settings").upsert(
    [
      { key: "transfers_open", value: input.open },
      // Numbers and times only, so never translated; parts left empty are stored as null.
      { key: "transfer_terms", value: input.terms },
      { key: "transfer_info", value: richText("transfer_info", input.info) },
      { key: "transfer_contact", value: richText("transfer_contact", input.contact) },
      // An empty link is stored as "" (the column is not null); the site reads it as none.
      { key: "discord_invite_url", value: input.discordUrl ?? "" },
      { key: "transfer_discord_url", value: input.transferDiscordUrl ?? "" },
    ],
    { onConflict: "key" },
  );
  if (error) return failed(log, "Saving Discord and transfers", error);

  await audit(access.user, "transfers.update", "site_settings", "transfers", {
    open: input.open,
    wasOpen,
    terms: hasTransferTerms(input.terms),
    kingdomDiscord: Boolean(input.discordUrl),
    transferDiscord: Boolean(input.transferDiscordUrl),
  });
  updateTag(CACHE_TAGS.settings);
  revalidatePath(adminPath(locale, "/transfers"));
  return {
    status: "saved",
    message: input.open
      ? "Saved: transfers show as open. Other languages follow within a minute."
      : "Saved: transfers show as closed. Other languages follow within a minute.",
  };
}
