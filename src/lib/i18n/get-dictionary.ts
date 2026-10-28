import { withReviewed } from "@/content/seed/ui-reviewed";
import { UI_KEYS, UI_STRINGS } from "@/content/seed/ui-strings";
import { getUiStrings } from "@/lib/data";
import type { Dictionary } from "./dictionary";
import { pick } from "./localized";

export type { Dictionary } from "./dictionary";

/**
 * Build the dictionary for a locale from the database strings, falling back
 * to the bundled text (with its reviewed translations) for anything missing. Server only.
 */
export async function getDictionary(locale: string): Promise<Dictionary> {
  const rows = await getUiStrings();
  const byKey = new Map(rows.map((row) => [row.key, row.text]));
  const dictionary = {} as Dictionary;
  for (const key of UI_KEYS) {
    const fromDb = pick(byKey.get(key), locale);
    dictionary[key] = fromDb || pick(withReviewed(key, UI_STRINGS[key]), locale);
  }
  return dictionary;
}
