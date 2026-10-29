import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PAGES } from "../../e2e/support/pages";

/**
 * Keeps docs/QA.md and the tests in step. Every spec row says how it is
 * checked: a `Browser` spec needs a test in e2e/ whose title starts with its
 * ID, a `Live` spec one in e2e/live/, a `Unit` spec names a test file that
 * must exist; `Manual` is the checklist. A test may only name IDs the page
 * lists, and every public page must be in the browser suite's page list.
 */

const ROOT = resolve(__dirname, "../..");

function filesUnder(dir: string, suffix: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filesUnder(path, suffix);
    return path.endsWith(suffix) ? [path] : [];
  });
}

/** The spec rows of the QA page: ID, how it is checked, in page order. */
export function qaSpecs(markdown: string): Array<{ id: string; checkedBy: string }> {
  return markdown.split("\n").flatMap((line) => {
    const row = /^\|\s*([A-Z]+-\d{2})\s*\|.*\|\s*([^|]+?)\s*\|$/.exec(line.trim());
    return row ? [{ id: row[1], checkedBy: row[2] }] : [];
  });
}

/** The spec IDs that test titles in a spec file start with. */
export function testedIds(source: string): string[] {
  return [...source.matchAll(/\btest\(\s*["'`]([A-Z]+-\d{2}) /g)].map((match) => match[1]);
}

/** The pages under src/app/[locale] as routes (`/kvk/prep`, `/guides/[slug]`), without the admin area, route groups or the catch-all. */
function publicRoutes(): string[] {
  const base = join(ROOT, "src", "app", "[locale]");
  return filesUnder(base, `${sep}page.tsx`)
    .map((file) => relative(base, file).split(sep).slice(0, -1))
    .filter((segments) => segments[0] !== "admin" && !segments.some((s) => s.startsWith("[...")))
    .map((segments) => `/${segments.filter((s) => !s.startsWith("(")).join("/")}`);
}

const specs = qaSpecs(readFileSync(join(ROOT, "docs", "QA.md"), "utf8"));
const specFiles = filesUnder(join(ROOT, "e2e"), ".spec.ts");
const idsIn = (live: boolean) =>
  new Set(specFiles.filter((file) => file.includes(`${sep}live${sep}`) === live).flatMap((file) => testedIds(readFileSync(file, "utf8"))));

describe("QA specs and tests", () => {
  it("lists each spec once, each checked in a known way", () => {
    const ids = specs.map((spec) => spec.id);
    expect(ids.length).toBeGreaterThan(30);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    expect(specs.filter((spec) => !/^(Browser|Live|Manual|Unit: tests\/\S+\.test\.ts)$/.test(spec.checkedBy))).toEqual([]);
  });

  it("has a browser test for every Browser spec and a live test for every Live spec", () => {
    const browser = idsIn(false);
    const live = idsIn(true);
    expect(specs.filter((s) => s.checkedBy === "Browser" && !browser.has(s.id)).map((s) => s.id)).toEqual([]);
    expect(specs.filter((s) => s.checkedBy === "Live" && !live.has(s.id)).map((s) => s.id)).toEqual([]);
  });

  it("names only specs from docs/QA.md in test titles, of the matching kind", () => {
    const kind = new Map(specs.map((spec) => [spec.id, spec.checkedBy]));
    expect([...idsIn(false)].filter((id) => kind.get(id) !== "Browser")).toEqual([]);
    expect([...idsIn(true)].filter((id) => kind.get(id) !== "Live")).toEqual([]);
  });

  it("points every Unit spec at a test file that exists", () => {
    const missing = specs.filter((s) => s.checkedBy.startsWith("Unit: ")).map((s) => s.checkedBy.slice("Unit: ".length)).filter((file) => !existsSync(join(ROOT, file)));
    expect(missing).toEqual([]);
  });

  it("opens every public page in the browser suite", () => {
    expect(PUBLIC_PAGES.map((page) => page.route).sort()).toEqual(publicRoutes().sort());
  });

  it("reads the formats it relies on (so a green run means something)", () => {
    expect(qaSpecs("| RS-01 | A room opens. | Browser |\n| --- | --- | --- |\n| KVK-06 | Rounds. | Unit: tests/lib/kvk/prep.test.ts |")).toEqual([
      { id: "RS-01", checkedBy: "Browser" },
      { id: "KVK-06", checkedBy: "Unit: tests/lib/kvk/prep.test.ts" },
    ]);
    expect(testedIds('test("RS-01 opens", …); test(`SITE-01 every page in ${locale}`, …); test("no id", …)')).toEqual(["RS-01", "SITE-01"]);
  });
});
