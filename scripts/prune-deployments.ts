/**
 * Deletes old Vercel deployments, so Deployment Storage (10 GB on the Hobby
 * plan; one build is about 150 MB) stays small. Keeps the live deployment, the
 * one before it (for a rollback), the newest preview of each open pull request
 * and anything still building; the rules are in src/lib/vercel/prune.ts. Run by
 * the Prune deployments workflow after every finished Vercel deployment and
 * once a day.
 *
 *   npm run deployments:prune                 # delete
 *   npm run deployments:prune -- --dry-run    # only list what would be deleted
 *
 * Needs VERCEL_TOKEN (SETUP.md § 5); without it nothing happens. Stops without
 * deleting anything when it can't tell which deployment is live or which pull
 * requests are open.
 */
import { deploymentsToDelete, type Deployment, KEEP_PRODUCTION, toDeployment } from "@/lib/vercel/prune";
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));

const TEAM = "rudy-0b44";
const PROJECT = "kingdom-1241";
/** The project's own vercel.app domain: it serves the live deployment, also once a custom domain is added. */
const PRODUCTION_DOMAIN = "kingdom-1241.vercel.app";
const REPOSITORY = process.env.GITHUB_REPOSITORY ?? "rajdeepiitkgp/kingdom-1241";

async function vercel(path: string, method = "GET"): Promise<unknown> {
  const url = new URL(path, "https://api.vercel.com");
  url.searchParams.set("slug", TEAM);
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` } });
  if (!response.ok) throw new Error(`Vercel ${method} ${url.pathname}: ${response.status} ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function listDeployments(): Promise<Deployment[]> {
  const all: Deployment[] = [];
  let until: number | null = null;
  do {
    const page = (await vercel(`/v7/deployments?projectId=${PROJECT}&limit=100${until === null ? "" : `&until=${until}`}`)) as { deployments?: unknown[]; pagination?: { next?: number | null } };
    for (const raw of page.deployments ?? []) {
      const deployment = toDeployment(raw);
      if (deployment) all.push(deployment);
    }
    until = page.pagination?.next ?? null;
  } while (until !== null);
  return all;
}

async function liveDeployment(): Promise<string | null> {
  const alias = (await vercel(`/v4/aliases/${PRODUCTION_DOMAIN}`)) as { deploymentId?: unknown };
  return typeof alias.deploymentId === "string" ? alias.deploymentId : null;
}

async function openBranches(): Promise<Set<string>> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/pulls?state=open&per_page=100`, { headers });
  if (!response.ok) throw new Error(`GitHub open pull requests: ${response.status}`);
  const pulls = (await response.json()) as { head?: { ref?: unknown } }[];
  return new Set(pulls.map((pull) => pull.head?.ref).filter((ref): ref is string => typeof ref === "string"));
}

async function main() {
  if (!process.env.VERCEL_TOKEN) {
    console.log("::warning::VERCEL_TOKEN is not set, so no deployment was deleted (SETUP.md § 5).");
    return;
  }
  const dryRun = Boolean(args["dry-run"]);
  const [deployments, live, branches] = await Promise.all([listDeployments(), liveDeployment(), openBranches()]);
  if (live === null || !deployments.some((d) => d.uid === live)) throw new Error(`Can't tell which deployment ${PRODUCTION_DOMAIN} serves; nothing deleted.`);
  console.log(`${deployments.length} deployments; live ${live}; open pull requests: ${[...branches].join(", ") || "none"}.`);

  const doomed = deploymentsToDelete(deployments, { live, production: KEEP_PRODUCTION, openBranches: branches });
  let deleted = 0;
  let failed = 0;
  for (const d of doomed) {
    const line = `${new Date(d.created).toISOString().slice(0, 16)} ${d.target ?? "preview"} ${d.branch ?? "?"} ${d.state} ${d.url ?? d.uid}`;
    if (dryRun) {
      console.log(`would delete ${line}`);
      continue;
    }
    try {
      await vercel(`/v13/deployments/${d.uid}`, "DELETE");
      deleted++;
      console.log(`deleted ${line}`);
    } catch (error) {
      failed++;
      console.error(`failed ${line}: ${error instanceof Error ? error.message : String(error)}`);
      // Rate-limited: the next run carries on.
      if (String(error).includes(": 429 ")) break;
    }
  }
  const kept = deployments.length - doomed.length;
  console.log(`\n${dryRun ? `Dry run: ${doomed.length} would be deleted` : `${deleted} deleted${failed ? `, ${failed} failed` : ""}`}, ${kept} kept.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
