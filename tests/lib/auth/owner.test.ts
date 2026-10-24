import { describe, expect, it } from "vitest";
import { isOwnerIdentity, parseOwner, parseOwners } from "@/lib/auth/owner";

describe("owner configuration", () => {
  it("parses a Discord handle or an e-mail", () => {
    expect(parseOwner("@Rudy_1241")).toEqual({ discordUsername: "rudy_1241", email: null });
    expect(parseOwner("Dev-Admin@kingdom1241.local")).toEqual({ discordUsername: null, email: "dev-admin@kingdom1241.local" });
    expect(parseOwner("")).toBeNull();
    expect(parseOwner(undefined)).toBeNull();
  });

  it("matches only the configured identity", () => {
    const owner = parseOwner("rudy_1241");
    expect(isOwnerIdentity({ discordUsername: "rudy_1241", email: "x@y.z" }, owner)).toBe(true);
    expect(isOwnerIdentity({ discordUsername: "someone", email: "x@y.z" }, owner)).toBe(false);
    expect(isOwnerIdentity({ discordUsername: "rudy_1241", email: null }, null)).toBe(false);
    const byEmail = parseOwner("dev-admin@kingdom1241.local");
    expect(isOwnerIdentity({ discordUsername: null, email: "dev-admin@kingdom1241.local" }, byEmail)).toBe(true);
  });

  it("accepts a comma-separated list (local development: Discord owner plus the dev account)", () => {
    const owners = parseOwners(" rudeus4098 , dev-admin@kingdom1241.local,, ");
    expect(owners).toHaveLength(2);
    expect(isOwnerIdentity({ discordUsername: "rudeus4098", email: null }, owners)).toBe(true);
    expect(isOwnerIdentity({ discordUsername: null, email: "dev-admin@kingdom1241.local" }, owners)).toBe(true);
    expect(isOwnerIdentity({ discordUsername: "someone", email: "other@x.y" }, owners)).toBe(false);
    expect(parseOwners("")).toEqual([]);
  });
});
