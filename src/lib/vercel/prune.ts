/**
 * Which Vercel deployments to delete (scripts/prune-deployments.ts; pure,
 * unit-tested). One build is about 150 MB (every page prerendered in every
 * language) and the Hobby plan stores 10 GB, while Vercel itself keeps every
 * deployment for 30 days. So only what is worth having is kept:
 *
 * - the deployment the production domain points to (even after a rollback to an older one),
 * - the newest production deployments up to `production` (the live one and the one before it, for a rollback),
 * - the newest preview of each branch with an open pull request,
 * - anything not finished yet (queued, building).
 *
 * Everything else that is finished (ready, failed, cancelled) goes.
 */

export interface Deployment {
  uid: string;
  /** Unix milliseconds. */
  created: number;
  /** READY, ERROR, CANCELED, BUILDING, QUEUED, INITIALIZING, … */
  state: string;
  /** "production", or null for a preview. */
  target: string | null;
  /** The Git branch it was built from, when Vercel knows it. */
  branch: string | null;
  url: string | null;
}

export interface KeepRules {
  /** Deployment id behind the production domain. */
  live: string;
  /** How many of the newest ready production deployments stay, the live one included. */
  production: number;
  /** Branches with an open pull request. */
  openBranches: ReadonlySet<string>;
}

/** The live deployment and the one before it. */
export const KEEP_PRODUCTION = 2;

const FINISHED = new Set(["READY", "ERROR", "CANCELED"]);

/** A deployment from Vercel's list (GET /v7/deployments); null when the entry is unusable. */
export function toDeployment(raw: unknown): Deployment | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const meta = (typeof r.meta === "object" && r.meta !== null ? r.meta : {}) as Record<string, unknown>;
  const state = r.state ?? r.readyState;
  if (typeof r.uid !== "string" || typeof r.created !== "number" || typeof state !== "string") return null;
  return {
    uid: r.uid,
    created: r.created,
    state,
    target: typeof r.target === "string" ? r.target : null,
    branch: typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : null,
    url: typeof r.url === "string" ? r.url : null,
  };
}

/** The deployments to delete, newest first. */
export function deploymentsToDelete(deployments: readonly Deployment[], rules: KeepRules): Deployment[] {
  const newestFirst = [...deployments].sort((a, b) => b.created - a.created);
  const keep = new Set([rules.live]);
  for (const d of newestFirst.filter((d) => d.target === "production" && d.state === "READY").slice(0, rules.production)) keep.add(d.uid);
  const previewed = new Set<string>();
  for (const d of newestFirst) {
    if (d.target === "production" || d.state !== "READY" || d.branch === null || !rules.openBranches.has(d.branch) || previewed.has(d.branch)) continue;
    previewed.add(d.branch);
    keep.add(d.uid);
  }
  return newestFirst.filter((d) => FINISHED.has(d.state) && !keep.has(d.uid));
}
