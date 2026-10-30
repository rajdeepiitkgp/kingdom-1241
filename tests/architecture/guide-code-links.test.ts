import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The code guide (guide/) links into the repository with <CodeLink path="…" />.
 * A pull request that moves or deletes a file a chapter points at fails here,
 * so the chapter is updated in the same pull request (CLAUDE.md, guide/README.md).
 */

const ROOT = resolve(__dirname, "../..");
const DOCS = join(ROOT, "guide/src/content/docs");
const CODE_LINK = /<CodeLink\s+path="([^"]+)"/g;

function chapters(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return chapters(path);
    return /\.mdx?$/.test(entry.name) ? [path] : [];
  });
}

function codeLinks(text: string): string[] {
  return [...text.matchAll(CODE_LINK)].map((match) => match[1]);
}

/** Why a CodeLink path is wrong, or null when it points at what it says. */
function pathProblem(path: string): string | null {
  if (path.startsWith("/") || path.startsWith("./") || path.includes("..")) return "must start at the repository root";
  const target = join(ROOT, path);
  if (!existsSync(target)) return "does not exist";
  const isFolder = statSync(target).isDirectory();
  if (isFolder && !path.endsWith("/")) return "is a folder: end it with /";
  if (!isFolder && path.endsWith("/")) return "is a file: drop the trailing /";
  return null;
}

describe("the code guide's links into the repository", () => {
  it("finds every CodeLink path in a chapter", () => {
    expect(codeLinks('See <CodeLink path="src/proxy.ts" /> and <CodeLink  path="src/lib/" />.')).toEqual(["src/proxy.ts", "src/lib/"]);
  });

  it("point at files and folders that exist", () => {
    const files = chapters(DOCS);
    expect(files.length).toBeGreaterThan(0);
    const problems = files.flatMap((file) =>
      codeLinks(readFileSync(file, "utf8")).flatMap((path) => {
        const problem = pathProblem(path);
        return problem ? [`${relative(ROOT, file)}: ${path} ${problem}`] : [];
      }),
    );
    expect(problems).toEqual([]);
  });
});
