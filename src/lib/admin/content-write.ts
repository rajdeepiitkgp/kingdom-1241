import type { SupabaseClient } from "@supabase/supabase-js";
import { markdownToHtml } from "@/lib/html";
import type { Localized } from "@/lib/i18n/localized";
import type { ActionState } from "./action-state";
import { bodySourceFor } from "./content-forms";
import { introSourceUnchanged, localizedUpdate } from "./forms";

/**
 * What the content editor's actions share when they write (server only: the
 * Markdown renderer and the database client): the text columns of a save,
 * the position of a new row, and the replies for a missing database or row.
 */

export const NO_DATABASE: ActionState = { status: "error", message: "The content editor needs the database." };
export const GONE: ActionState = { status: "error", message: "This text no longer exists. Reload the page." };

/** A unique column (an address, an alliance in a guide) is already taken. */
export function uniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/**
 * `body` and `body_source` after an English save. An unchanged English text
 * keeps its translations and their Markdown (comparing fresh HTML instead
 * would drop them whenever the stored HTML came from the seed or an older
 * renderer); a changed one keeps English only and the pipeline refills the rest.
 */
export function bodyColumns(existing: { body: Localized; body_source?: Localized | null } | null, markdown: string): { body: Localized; body_source: Localized } {
  const shown = existing ? bodySourceFor({ body: existing.body, bodySource: existing.body_source ?? null }, "en") : "";
  const body = existing && introSourceUnchanged(markdown, shown) ? existing.body : localizedUpdate(existing?.body, markdownToHtml(markdown));
  const bodySource = existing && body === existing.body ? { ...(existing.body_source ?? {}), en: markdown } : { en: markdown };
  return { body, body_source: bodySource };
}

/** The position after the last row (of one topic, with `scope`); new rows go last and the arrows move them. */
export async function nextSortOrder(
  admin: SupabaseClient,
  table: string,
  scope?: { column: string; value: string },
): Promise<{ value: number } | { error: { message: string; code?: string } }> {
  let query = admin.from(table).select("sort_order").order("sort_order", { ascending: false }).limit(1);
  if (scope) query = query.eq(scope.column, scope.value);
  const { data, error } = await query;
  if (error) return { error };
  const last = data?.[0]?.sort_order;
  return { value: typeof last === "number" ? last + 1 : 0 };
}
