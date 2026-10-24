import { describe, expect, it } from "vitest";
import { canEditContent, canManageUsers, hasRole, higherRole, parseRole } from "@/lib/auth/roles";

describe("roles", () => {
  it("parses known roles and falls back otherwise", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("moderator")).toBe("moderator");
    expect(parseRole("owner")).toBe("member");
    expect(parseRole(undefined, "moderator")).toBe("moderator");
  });

  it("ranks admin above moderator above member", () => {
    expect(hasRole("admin", "moderator")).toBe(true);
    expect(hasRole("moderator", "admin")).toBe(false);
    expect(hasRole("member", "member")).toBe(true);
    expect(higherRole("member", "moderator")).toBe("moderator");
    expect(higherRole("admin", "moderator")).toBe("admin");
  });

  it("splits content editing from user management", () => {
    expect(canEditContent("moderator")).toBe(true);
    expect(canEditContent("member")).toBe(false);
    expect(canManageUsers("moderator")).toBe(false);
    expect(canManageUsers("admin")).toBe(true);
  });
});

describe("owner rules", () => {
  it("protects the owner and reserves administrator changes for the owner", async () => {
    const { grantProblem, roleChangeProblem } = await import("@/lib/auth/roles");
    const base = { actorIsOwner: false, actorIsTarget: false, targetIsOwner: false };
    expect(roleChangeProblem({ ...base, from: "member", to: "moderator" })).toBeNull();
    expect(roleChangeProblem({ ...base, from: "moderator", to: "member" })).toBeNull();
    expect(roleChangeProblem({ ...base, from: "member", to: "admin" })).toMatch(/owner/);
    expect(roleChangeProblem({ ...base, from: "admin", to: "moderator" })).toMatch(/owner/);
    expect(roleChangeProblem({ ...base, actorIsOwner: true, from: "member", to: "admin" })).toBeNull();
    expect(roleChangeProblem({ ...base, actorIsOwner: true, actorIsTarget: true, from: "admin", to: "member" })).toMatch(/own role/);
    expect(roleChangeProblem({ ...base, actorIsOwner: true, targetIsOwner: true, from: "admin", to: "member" })).toMatch(/owner/);
    expect(grantProblem({ actorIsOwner: false, role: "admin" })).toMatch(/owner/);
    expect(grantProblem({ actorIsOwner: false, role: "moderator" })).toBeNull();
    expect(grantProblem({ actorIsOwner: true, role: "admin" })).toBeNull();
  });
});

describe("removeAccountProblem", () => {
  it("protects the owner, the actor and administrators (unless the owner acts)", async () => {
    const { removeAccountProblem } = await import("@/lib/auth/roles");
    const base = { actorIsOwner: false, actorIsTarget: false, targetIsOwner: false, targetRole: "moderator" as const };
    expect(removeAccountProblem(base)).toBeNull();
    expect(removeAccountProblem({ ...base, targetIsOwner: true })).toMatch(/owner/);
    expect(removeAccountProblem({ ...base, actorIsTarget: true })).toMatch(/own account/);
    expect(removeAccountProblem({ ...base, targetRole: "admin" })).toMatch(/Only the owner/);
    expect(removeAccountProblem({ ...base, targetRole: "admin", actorIsOwner: true })).toBeNull();
  });
});

describe("grantsFor", () => {
  it("matches pre-authorisations by Discord handle or e-mail only", async () => {
    const { grantsFor } = await import("@/lib/auth/roles");
    const grants = [
      { id: "1", discordUsername: "cleo", email: null },
      { id: "2", discordUsername: null, email: "cleo@x.y" },
      { id: "3", discordUsername: "other", email: null },
      { id: "4", discordUsername: null, email: null },
    ];
    expect(grantsFor(grants, { discordUsername: "cleo", email: "cleo@x.y" }).map((g) => g.id)).toEqual(["1", "2"]);
    expect(grantsFor(grants, { discordUsername: null, email: null })).toEqual([]);
  });
});
