import type { UiKey } from "@/content/seed/ui-strings";

/**
 * All interface strings for one locale. Serialisable — safe to pass from
 * Server Components to Client Components as a prop.
 * (Built on the server by `getDictionary` in `./get-dictionary.ts`.)
 *
 * A page gets the slice it needs (`getDictionary(locale, PAGE_STRINGS)`),
 * not all 865 strings: the dictionary rides in every page's payload, and
 * most pages use a few dozen of its keys. The slice is still typed as the
 * whole `Dictionary`, so components stay as they are; the architecture test
 * tests/architecture/page-strings.test.ts walks every page's imports and
 * fails when a key the page can reach isn't covered by its prefixes.
 */
export type Dictionary = Record<UiKey, string>;

/**
 * True when `key` is one of the prefixes or sits below one (`"kvk"` covers
 * `"kvk.role.lead"`, not `"kvkx"`). A prefix ending in `.*` covers only the
 * keys one segment below it: `"tour.*"` is the tour card's own labels
 * (`tour.next`, `tour.close`), not the steps of every tour (`tour.kvk.lock.body`).
 */
export function coversKey(prefixes: readonly string[], key: string): boolean {
  return prefixes.some((prefix) => {
    if (prefix.endsWith(".*")) {
      const parent = prefix.slice(0, -2);
      return key.startsWith(`${parent}.`) && !key.slice(parent.length + 1).includes(".");
    }
    return key === prefix || key.startsWith(`${prefix}.`);
  });
}

/** The strings under the given prefixes, as a dictionary (the keys outside are left out, see above). */
export function pickDictionary(dictionary: Dictionary, prefixes: readonly string[]): Dictionary {
  const picked = {} as Dictionary;
  for (const key of Object.keys(dictionary) as UiKey[]) if (coversKey(prefixes, key)) picked[key] = dictionary[key];
  return picked;
}

/** Replace `{name}` placeholders in a string with the values given; any other name, `{constructor}` included, stays as it is. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : match));
}
