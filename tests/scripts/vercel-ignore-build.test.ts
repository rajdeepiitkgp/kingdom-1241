import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * scripts/vercel-ignore-build.sh, Vercel's ignored build step, run for real
 * against small git histories in a temporary folder. Exit 0 = skip, 1 = build.
 */
const SCRIPT = resolve(__dirname, "../../scripts/vercel-ignore-build.sh");
const folders: string[] = [];
afterAll(() => folders.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** No user or system git config (signing, hooks), and no variables from the shell running the tests. */
const isolated = (dir: string) => ({ PATH: process.env.PATH ?? "", HOME: dir, GIT_CONFIG_NOSYSTEM: "1", LC_ALL: "C" }) as unknown as NodeJS.ProcessEnv;

function repo() {
  const dir = mkdtempSync(join(tmpdir(), "ignore-build-"));
  folders.push(dir);
  const git = (...args: string[]) =>
    execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args], {
      cwd: dir,
      env: isolated(dir),
      encoding: "utf8",
    }).trim();
  git("init", "-q");
  /** Writes the files (null deletes) and commits them; returns the commit's sha. */
  const commit = (message: string, files: Record<string, string | null>) => {
    for (const [path, content] of Object.entries(files)) {
      if (content === null) git("rm", "-q", path);
      else {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), content);
        git("add", path);
      }
    }
    git("commit", "-q", "--allow-empty", "-m", message);
    return git("rev-parse", "HEAD");
  };
  const run = (env: Record<string, string>) => {
    const result = spawnSync("bash", [SCRIPT], { cwd: dir, env: { ...isolated(dir), ...env }, encoding: "utf8" });
    return { code: result.status, out: `${result.stdout}${result.stderr}` };
  };
  return { git, commit, run };
}

/** main with one merged pull request, the way GitHub merges them. */
function mainWithSite() {
  const r = repo();
  r.commit("initial", { "src/app/page.tsx": "page", "README.md": "readme", "package.json": "{}" });
  const merged = r.commit("Merge pull request #1 from someone/feat/a", { "src/app/page.tsx": "page 2" });
  return { ...r, merged };
}

describe("the pause switch", () => {
  it("skips every build while PAUSE_DEPLOYS is on, whatever changed", () => {
    const r = mainWithSite();
    const prev = r.merged;
    r.commit("Merge pull request #2 from someone/feat/b", { "src/app/page.tsx": "page 3" });
    for (const value of ["1", "true", "TRUE", "yes", "on"]) {
      const { code, out } = r.run({ PAUSE_DEPLOYS: value, VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: prev });
      expect(code, value).toBe(0);
      expect(out).toContain("PAUSE_DEPLOYS is on for production");
    }
  });

  it("builds when the switch is off or set to anything else", () => {
    const r = mainWithSite();
    const prev = r.merged;
    r.commit("Merge pull request #2 from someone/feat/b", { "src/app/page.tsx": "page 3" });
    for (const value of ["", "0", "false", "off", "no"]) {
      expect(r.run({ PAUSE_DEPLOYS: value, VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: prev }).code, value).toBe(1);
    }
  });
});

describe("a deployment with an earlier one on its branch", () => {
  it("skips when only the guide, docs, tests, CI, SQL, scripts or notes changed", () => {
    const r = mainWithSite();
    const prev = r.merged;
    r.commit("Merge pull request #2 from someone/docs/guide", {
      "guide/src/content/docs/index.mdx": "guide",
      "docs/QA.md": "qa",
      "e2e/home.spec.ts": "test",
      "tests/lib/x.test.ts": "test",
      ".github/workflows/ci.yml": "ci",
      "supabase/migrations/0099_x.sql": "sql",
      "scripts/seed.ts": "seed",
      "README.md": "readme 2",
      "CLAUDE.md": "notes",
      "playwright.config.ts": "config",
    });
    const { code, out } = r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: prev });
    expect(code).toBe(0);
    expect(out).toContain(`since the last deployment (${prev.slice(0, 7)})`);
  });

  it("builds when a site file changed, and names it", () => {
    for (const path of ["src/lib/x.ts", "public/items/a.webp", "package.json", "package-lock.json", "next.config.ts", "vercel.json", "src/content/notes.md", "postcss.config.mjs"]) {
      const r = mainWithSite();
      const prev = r.merged;
      r.commit("Merge pull request #2", { [path]: "changed", "docs/PLAN.md": "plan" });
      const { code, out } = r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: prev });
      expect(code, path).toBe(1);
      expect(out, path).toContain(`  ${path}`);
      expect(out, path).not.toContain("docs/PLAN.md");
    }
  });

  it("builds for a site change several commits back, not only the last one", () => {
    const r = mainWithSite();
    const prev = r.merged;
    r.commit("Merge pull request #2", { "src/app/page.tsx": "page 3" });
    r.commit("Merge pull request #3", { "guide/a.mdx": "guide" });
    expect(r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: prev }).code).toBe(1);
  });

  it("builds when a site file moved out of src", () => {
    const r = mainWithSite();
    const prev = r.merged;
    r.commit("make room", { "docs/PLAN.md": "plan" });
    r.git("mv", "src/app/page.tsx", "docs/page.tsx");
    r.commit("Merge pull request #2", {});
    expect(r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: prev }).code).toBe(1);
  });

  it("builds a redeploy of the commit already deployed", () => {
    const r = mainWithSite();
    const { code, out } = r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: r.merged });
    expect(code).toBe(1);
    expect(out).toContain("a redeploy");
  });

  it("builds when the last deployed commit is older than the clone", () => {
    const r = mainWithSite();
    r.commit("Merge pull request #2", { "guide/a.mdx": "guide" });
    const { code, out } = r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: "0123456789abcdef0123456789abcdef01234567" });
    expect(code).toBe(1);
    expect(out).toContain("older than the clone");
  });
});

describe("a branch's first deployment", () => {
  it("skips a first preview whose branch only touches the guide", () => {
    const r = mainWithSite();
    r.git("checkout", "-q", "-b", "docs/guide");
    r.commit("guide part 3", { "guide/src/content/docs/tools.mdx": "tools" });
    r.commit("guide part 4", { "guide/src/content/docs/folders.mdx": "folders" });
    const { code, out } = r.run({ VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: "" });
    expect(code).toBe(0);
    expect(out).toContain(`since the branch left main (${r.merged.slice(0, 7)})`);
  });

  it("builds a first preview with a site change in any of its commits", () => {
    const r = mainWithSite();
    r.git("checkout", "-q", "-b", "feat/x");
    r.commit("code", { "src/lib/x.ts": "x" });
    r.commit("docs", { "docs/PLAN.md": "plan" });
    expect(r.run({ VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: "" }).code).toBe(1);
  });

  it("builds a first preview when no merge into main is in the clone", () => {
    const r = repo();
    r.commit("initial", { "src/app/page.tsx": "page" });
    r.commit("guide", { "guide/a.mdx": "guide" });
    const { code, out } = r.run({ VERCEL_ENV: "preview", VERCEL_GIT_PREVIOUS_SHA: "" });
    expect(code).toBe(1);
    expect(out).toContain("no merge into main within the clone");
  });

  it("builds production's first deployment, and anything whose environment is unknown", () => {
    const r = mainWithSite();
    r.git("checkout", "-q", "-b", "docs/guide");
    r.commit("guide", { "guide/a.mdx": "guide" });
    expect(r.run({ VERCEL_ENV: "production", VERCEL_GIT_PREVIOUS_SHA: "" }).code).toBe(1);
    expect(r.run({}).code).toBe(1);
  });
});
