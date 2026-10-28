import { describe, expect, it } from "vitest";
import { type Deployment, deploymentsToDelete, KEEP_PRODUCTION, toDeployment } from "@/lib/vercel/prune";

let clock = 0;
const deployment = (uid: string, target: "production" | null, branch: string, state = "READY"): Deployment => ({ uid, created: ++clock, state, target, branch, url: `${uid}.vercel.app` });

// Oldest first, the way they were made: a PR's previews, then its merge to production.
const history = [
  deployment("p1", "production", "main"),
  deployment("a1", null, "feat/a"),
  deployment("a2", null, "feat/a"),
  deployment("p2", "production", "main"),
  deployment("b1", null, "feat/b", "ERROR"),
  deployment("b2", null, "feat/b"),
  deployment("p3", "production", "main"),
  deployment("c1", null, "fix/c"),
  deployment("c2", null, "fix/c"),
  deployment("x1", null, "fix/c", "CANCELED"),
];

const ids = (list: Deployment[]) => list.map((d) => d.uid);

describe("which deployments go", () => {
  it("keeps the live one, the one before it and the newest preview of an open pull request", () => {
    const gone = deploymentsToDelete(history, { live: "p3", production: KEEP_PRODUCTION, openBranches: new Set(["fix/c"]) });
    expect(ids(gone)).toEqual(["x1", "c1", "b2", "b1", "a2", "a1", "p1"]);
  });

  it("keeps only production when no pull request is open", () => {
    const gone = deploymentsToDelete(history, { live: "p3", production: 2, openBranches: new Set() });
    expect(ids(history).filter((id) => !ids(gone).includes(id))).toEqual(["p2", "p3"]);
  });

  it("never deletes the live deployment after a rollback to an older one", () => {
    const gone = deploymentsToDelete(history, { live: "p1", production: 2, openBranches: new Set() });
    expect(ids(gone)).not.toContain("p1");
    expect(ids(gone)).not.toContain("p3");
    expect(ids(gone)).not.toContain("p2");
  });

  it("leaves anything still building or queued alone", () => {
    const building = [...history, deployment("p4", "production", "main", "BUILDING"), deployment("d1", null, "feat/d", "QUEUED")];
    const gone = deploymentsToDelete(building, { live: "p3", production: 2, openBranches: new Set() });
    expect(ids(gone)).not.toContain("p4");
    expect(ids(gone)).not.toContain("d1");
    // A build that hasn't finished doesn't count as one of the production deployments kept.
    expect(ids(gone)).not.toContain("p2");
  });

  it("doesn't count a failed production build as one of those kept", () => {
    const failed = [...history, deployment("p4", "production", "main", "ERROR")];
    const gone = deploymentsToDelete(failed, { live: "p3", production: 2, openBranches: new Set() });
    expect(ids(gone)).toContain("p4");
    expect(ids(gone)).not.toContain("p2");
  });

  it("deletes nothing when everything is worth keeping", () => {
    const fresh = [deployment("q1", "production", "main"), deployment("q2", "production", "main")];
    expect(deploymentsToDelete(fresh, { live: "q2", production: 2, openBranches: new Set() })).toEqual([]);
  });
});

describe("reading Vercel's list", () => {
  it("takes the fields it needs, the branch from the Git metadata", () => {
    expect(toDeployment({ uid: "dpl_1", created: 5, state: "READY", target: "production", url: "x.vercel.app", meta: { githubCommitRef: "main" } })).toEqual({
      uid: "dpl_1",
      created: 5,
      state: "READY",
      target: "production",
      branch: "main",
      url: "x.vercel.app",
    });
    expect(toDeployment({ uid: "dpl_2", created: 6, readyState: "ERROR", target: null, url: null })).toEqual({ uid: "dpl_2", created: 6, state: "ERROR", target: null, branch: null, url: null });
  });

  it("skips an entry it can't read", () => {
    for (const raw of [null, "dpl", {}, { uid: "dpl_3", created: "5", state: "READY" }, { uid: "dpl_4", created: 5 }]) expect(toDeployment(raw)).toBeNull();
  });
});
