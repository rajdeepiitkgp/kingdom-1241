import type { UiKey } from "@/content/seed/ui-strings";

/**
 * All interface strings for one locale. Serialisable — safe to pass from
 * Server Components to Client Components as a prop.
 * (Built on the server by `getDictionary` in `./get-dictionary.ts`.)
 */
export type Dictionary = Record<UiKey, string>;

/** Replace `{name}` placeholders in a string. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
