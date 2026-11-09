import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { UI_KEYS, UI_STRINGS } from "@/content/seed/ui-strings";
import { coversKey, type Dictionary, pickDictionary } from "@/lib/i18n/dictionary";
import { uiLabelKeys } from "@/lib/tour/tour";

/**
 * Every public page gets a slice of the interface strings, not all of them
 * (`getDictionary(locale, PAGE_STRINGS)`; the dictionary rides in every page's
 * payload, and a page uses a few dozen of its 865 keys). A key the page's code
 * can reach but its slice doesn't hold would render as nothing, so this test
 * walks each page's imports (server and client files alike), collects the keys
 * it can use and fails when one isn't covered:
 *
 *   - string literals that are keys (`dict["kvk.title"]`, a `labelKey` in a
 *     list, the title of a tour step);
 *   - template keys `` `kvk.role.${role}` `` by their fixed prefix;
 *   - tour steps (`uiStep(target, "kvk.lock")` → `tour.kvk.lock.title/body`)
 *     and the `{{ui:<key>}}` labels their texts name.
 *
 * A prefix that covers nothing the page reaches fails too, so the lists stay
 * honest. The admin pages keep the whole dictionary (English only, few visits).
 */

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");
const APP = join(SRC, "app/[locale]");
const SOURCE_EXT = [".ts", ".tsx"];
const KEYS = new Set<string>(UI_KEYS);
/** Files whose key literals are the strings themselves, not uses of them. */
const DEFINITIONS = ["content/seed/"];

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listSources(path));
    else if (SOURCE_EXT.some((ext) => entry.endsWith(ext)) && !entry.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Value imports and re-exports of a module (specifiers only); `import type` is left out. */
function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of code.matchAll(re)) {
    if (match[2]) continue;
    const spec = match[4] ?? match[5] ?? match[6];
    if (spec) specifiers.push(spec);
  }
  return specifiers;
}

function resolveSpecifier(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, ...SOURCE_EXT.map((ext) => base + ext), ...SOURCE_EXT.map((ext) => join(base, `index${ext}`))]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const rel = (file: string) => relative(SRC, file).split("\\").join("/");

/** Every module under src/ reachable from `entry` through value imports, itself included. */
function graph(entry: string): string[] {
  const reached = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
      const target = resolveSpecifier(file, spec);
      if (target && !reached.has(target)) {
        reached.add(target);
        queue.push(target);
      }
    }
  }
  return [...reached];
}

interface Uses {
  keys: Set<string>;
  /** Fixed prefixes of template keys, `kvk.role` for `` `kvk.role.${x}` ``. */
  prefixes: Set<string>;
}

const LITERAL_KEY = /["']([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)+)["']/g;
const TEMPLATE_KEY = /`([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)*)\.\$\{/g;
const TOUR_STEP = /uiStep\(\s*[^,]+,\s*["']([^"']+)["']/g;

function usesIn(file: string): Uses {
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  if (DEFINITIONS.some((part) => rel(file).startsWith(part))) return { keys, prefixes };
  const code = stripComments(readFileSync(file, "utf8"));
  for (const match of code.matchAll(LITERAL_KEY)) if (KEYS.has(match[1])) keys.add(match[1]);
  // `tour.${key}.title` is how uiStep builds its keys; the steps themselves are read below.
  for (const match of code.matchAll(TEMPLATE_KEY)) if (match[1] !== "tour" && UI_KEYS.some((key) => key.startsWith(`${match[1]}.`))) prefixes.add(match[1]);
  for (const match of code.matchAll(TOUR_STEP)) for (const key of [`tour.${match[1]}.title`, `tour.${match[1]}.body`]) if (KEYS.has(key)) keys.add(key);
  return { keys, prefixes };
}

/** What a page can use: the uses of every module it reaches, plus the labels its tour texts name. */
function needsOf(entry: string): Uses {
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  for (const file of graph(entry)) {
    const uses = usesIn(file);
    uses.keys.forEach((key) => keys.add(key));
    uses.prefixes.forEach((prefix) => prefixes.add(prefix));
  }
  for (const key of [...keys]) {
    if (!key.startsWith("tour.")) continue;
    for (const text of Object.values(UI_STRINGS[key as keyof typeof UI_STRINGS])) for (const label of uiLabelKeys(String(text))) if (KEYS.has(label)) keys.add(label);
  }
  return { keys, prefixes };
}

/** The prefixes a page declares: the array behind the second argument of every `getDictionary(…)` call; null when a call has none. */
function declaredPrefixes(source: string): string[] | null {
  const prefixes = new Set<string>();
  const calls = [...source.matchAll(/getDictionary\(((?:[^()]|\([^()]*\))*)\)/g)];
  if (calls.length === 0) return [];
  for (const call of calls) {
    const second = /,\s*([A-Za-z_$][\w$]*|\[[^\]]*\])\s*$/.exec(call[1]);
    if (!second) return null;
    const literal = second[1].startsWith("[") ? second[1] : (new RegExp(`const\\s+${second[1]}\\s*(?::[^=]+)?=\\s*(\\[[^\\]]*\\])`).exec(source)?.[1] ?? null);
    if (!literal) return null;
    for (const match of literal.matchAll(/["']([^"']+)["']/g)) prefixes.add(match[1]);
  }
  return [...prefixes];
}

/** A list to paste when a page's prefixes are missing or off: top-level namespaces, tours by their page. */
function suggest(needs: Uses): string[] {
  const out = new Set<string>();
  const top = (key: string) => {
    const parts = key.split(".");
    if (parts[0] !== "tour") return parts[0];
    // `tour.next` is the tour card's own label, `tour.kvk.lock.body` a step of the KvK tour.
    return parts.length === 2 ? "tour.*" : parts.slice(0, 2).join(".");
  };
  needs.keys.forEach((key) => out.add(top(key)));
  needs.prefixes.forEach((prefix) => out.add(top(prefix)));
  return [...out].sort();
}

const FULL = Object.fromEntries(UI_KEYS.map((key) => [key, key])) as Dictionary;

describe("page strings", () => {
  const pages = listSources(APP).filter((file) => !rel(file).includes("/admin/") && /getDictionary\(/.test(readFileSync(file, "utf8")));

  it("finds the public pages", () => {
    expect(pages.map(rel)).toContain("app/[locale]/page.tsx");
    expect(pages.map(rel)).toContain("app/[locale]/layout.tsx");
    expect(pages.length).toBeGreaterThan(12);
  });

  it("sees literal keys, template prefixes, tour steps and the labels tour texts name", () => {
    const rules = needsOf(join(APP, "rules/page.tsx"));
    expect(rules.keys.has("rules.title")).toBe(true);
    expect(rules.keys.has("sync.title")).toBe(false);
    const kvk = needsOf(join(APP, "kvk/page.tsx"));
    expect(kvk.keys.has("tour.kvk.unlock.body")).toBe(true);
    expect(kvk.keys.has("tour.leaders.rules.body")).toBe(false);
    expect(kvk.prefixes.has("kvk.role")).toBe(true);
    // A tour body that names a button ({{ui:…}}) pulls that label in.
    const named = UI_KEYS.find((key) => key.startsWith("tour.sync.") && uiLabelKeys(UI_STRINGS[key].en).length > 0);
    expect(named).toBeDefined();
    const room = needsOf(join(APP, "tools/rally-sync/[code]/page.tsx"));
    for (const label of uiLabelKeys(UI_STRINGS[named!].en)) expect(room.keys.has(label)).toBe(true);
  });

  for (const page of pages) {
    it(`${rel(page)} declares the strings it can use`, () => {
      const source = readFileSync(page, "utf8");
      const declared = declaredPrefixes(source);
      const needs = needsOf(page);
      expect(declared, `${rel(page)} calls getDictionary(locale) without its PAGE_STRINGS; it needs ${JSON.stringify(suggest(needs))}`).not.toBeNull();
      const slice = pickDictionary(FULL, declared!);
      const missingKeys = [...needs.keys].filter((key) => !(key in slice)).sort();
      const missingPrefixes = [...needs.prefixes].filter((prefix) => !coversKey(declared!, prefix)).sort();
      expect({ missingKeys, missingPrefixes }, `${rel(page)}: keys its code can reach but its slice lacks. Suggested PAGE_STRINGS: ${JSON.stringify(suggest(needs))}`).toEqual({ missingKeys: [], missingPrefixes: [] });
      const unused = declared!.filter((prefix) => ![...needs.keys, ...needs.prefixes].some((use) => coversKey([prefix], use)));
      expect(unused, `${rel(page)}: prefixes that cover nothing the page reaches`).toEqual([]);
    });
  }
});
