"use server";

import { revalidatePath, updateTag } from "next/cache";
import { adminPath } from "@/lib/auth/paths";
import { checkOwner } from "@/lib/auth/server";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { parseCapacityForm } from "@/lib/rally-sync/capacity";
import { roomCapacity } from "@/lib/rally-sync/session";
import { RallyStoreError, rallyStore } from "@/lib/rally-sync/store";
import { actionLogger, denied, failed, INVALID_FIELDS, invalid } from "./action-helpers";
import type { ActionState } from "./action-state";
import { audit } from "./audit";
import { localeField } from "./forms";

/**
 * Server Actions of the owner's settings page. Every one re-checks that the
 * caller is the owner (the page and its link are the owner's only, but an
 * action can be POSTed directly) and writes an audit entry with the old and
 * new values.
 */

const OWNER_ONLY = "Only the owner can change the settings.";

export async function saveRallyCapacity(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await checkOwner();
  if ("denied" in access) return denied(access.denied, OWNER_ONLY);
  const log = await actionLogger();
  const parsed = parseCapacityForm(formData);
  if (!parsed.ok) return invalid(parsed.errors, parsed.message ?? INVALID_FIELDS);
  const store = rallyStore();
  if (!store) return { status: "error", message: "Rally Sync needs the database." };
  try {
    const before = await roomCapacity(store);
    await store.writeCapacity(parsed.value);
    if (store.kind === "supabase") await audit(access.user, "config.update", "app_config", "rally_sync_capacity", { before, after: parsed.value });
    log.info("Rally Sync limits saved");
    updateTag(CACHE_TAGS.config);
    const locale = localeField(formData);
    revalidatePath(adminPath(locale, "/settings"));
    revalidatePath(adminPath(locale, "/rally-sync"));
    return { status: "saved", message: "Saved. The new limits apply from now on." };
  } catch (error) {
    if (error instanceof RallyStoreError && error.problem === "not_migrated") {
      return { status: "error", message: "The database doesn't have the settings table yet (migration 0016). Try again once the deploy has finished." };
    }
    return failed(log, "Saving the Rally Sync limits", { message: error instanceof Error ? error.message : String(error) });
  }
}
