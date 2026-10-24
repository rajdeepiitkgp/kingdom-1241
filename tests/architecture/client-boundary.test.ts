import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps server-only code out of the browser bundle. Starting from every file
 * with a "use client" directive, it follows the value imports (type-only
 * imports are erased, "use server" modules only hand the client a reference)
 * and fails when one of the modules below is reachable. That is how the rules
 * page once shipped the HTML sanitiser and the Markdown parser to every
 * visitor (~79 KB gzipped), and it is the rule from CLAUDE.md that the
 * service-role client must never be imported by a Client Component.
 */

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");

/** Modules (paths under src/, or package names) a Client Component must never pull in. */
const SERVER_ONLY = [
  "lib/html.ts",
  "lib/supabase/admin.ts",
  "lib/supabase/public.ts",
  "lib/auth/server.ts",
  "lib/data/index.ts",
  "lib/admin/audit.ts",
  "lib/admin/kvk-data.ts",
  "lib/admin/users-data.ts",
  "lib/kvk/throttle-store.ts",
  "lib/admin/retro-data.ts",
  "lib/retro/mightpulse.ts",
  "lib/retro/governor.ts",
  "lib/retro/prune.ts",
  "lib/alerts.ts",
  "lib/translate/translate-row.ts",
  "lib/translate/provider.ts",
  "lib/backup/crypto.ts",
  "lib/backup/tables.ts",
  "content/seed/index.ts",
];
const SERVER_ONLY_PACKAGES = ["sanitize-html", "marked", "@supabase/supabase-js", "@supabase/ssr", "@anthropic-ai/sdk", "@google/genai", "server-only"];

const SOURCE_EXT = [".ts", ".tsx"];

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...listSources(path));
    else if (SOURCE_EXT.some((ext) => entry.endsWith(ext)) && !entry.endsWith(".d.ts")) out.push(path);
  }
  return out;
}

function directive(source: string): "use client" | "use server" | null {
  const match = /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["'](use client|use server)["']/.exec(source);
  return (match?.[1] as "use client" | "use server" | undefined) ?? null;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Value imports and re-exports of a module (specifiers only); `import type` is left out. */
function importSpecifiers(source: string): string[] {
  const code = stripComments(source);
  const specifiers: string[] = [];
  const re = /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of code.matchAll(re)) {
    if (match[2]) continue; // import type / export type
    const spec = match[4] ?? match[5] ?? match[6];
    if (spec) specifiers.push(spec);
  }
  return specifiers;
}

function resolveSpecifier(from: string, spec: string): { file?: string; pkg?: string } {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return { pkg: spec };
  for (const candidate of [base, ...SOURCE_EXT.map((ext) => base + ext), ...SOURCE_EXT.map((ext) => join(base, `index${ext}`))]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return { file: candidate };
  }
  return {};
}

function rel(file: string): string {
  return relative(SRC, file).split("\\").join("/");
}

/** Every module reachable from `entry` through value imports, with the path that reached it. */
function clientGraph(entry: string): Map<string, string[]> {
  const reached = new Map<string, string[]>();
  const queue: Array<{ file: string; path: string[] }> = [{ file: entry, path: [rel(entry)] }];
  while (queue.length > 0) {
    const { file, path } = queue.shift()!;
    const source = readFileSync(file, "utf8");
    for (const spec of importSpecifiers(source)) {
      const target = resolveSpecifier(file, spec);
      if (target.pkg) {
        const key = `pkg:${target.pkg}`;
        if (!reached.has(key)) reached.set(key, [...path, target.pkg]);
        continue;
      }
      if (!target.file || reached.has(rel(target.file))) continue;
      const next = [...path, rel(target.file)];
      reached.set(rel(target.file), next);
      // A "use server" module gives the client a reference to its actions, not its imports.
      if (directive(readFileSync(target.file, "utf8")) === "use server") continue;
      queue.push({ file: target.file, path: next });
    }
  }
  return reached;
}

describe("client components", () => {
  const sources = listSources(SRC);
  const clientEntries = sources.filter((file) => directive(readFileSync(file, "utf8")) === "use client");

  it("exist (the scan found the client entry points)", () => {
    expect(clientEntries.length).toBeGreaterThan(10);
    expect(clientEntries.map(rel)).toContain("components/rules/RulesTabs.tsx");
  });

  it("never reach a server-only module or package", () => {
    const offences: string[] = [];
    for (const entry of clientEntries) {
      const graph = clientGraph(entry);
      for (const [mod, path] of graph) {
        const pkg = mod.startsWith("pkg:") ? mod.slice(4) : null;
        const forbidden = pkg
          ? SERVER_ONLY_PACKAGES.some((name) => pkg === name || pkg.startsWith(`${name}/`)) || pkg.startsWith("node:")
          : SERVER_ONLY.includes(mod);
        if (forbidden) offences.push(path.join(" → "));
      }
    }
    expect(offences, `server-only code reachable from a Client Component:\n${offences.join("\n")}`).toEqual([]);
  });

  it("guards modules that actually exist (keep the list in step with the code)", () => {
    for (const mod of SERVER_ONLY) expect(existsSync(join(SRC, mod)), mod).toBe(true);
  });
});
