import { describe, expect, it } from "vitest";
import { activeAdminPath, adminNavGroups } from "@/lib/admin/nav";

const labels = (access: { canManageUsers: boolean; isOwner: boolean }) =>
  adminNavGroups(access).map((group) => [group.label, group.items.map((item) => item.label)]);

describe("adminNavGroups", () => {
  it("shows Users to administrators and Settings to the owner only", () => {
    expect(labels({ canManageUsers: true, isOwner: true }).at(-1)).toEqual(["Access & settings", ["Users", "Settings"]]);
    expect(labels({ canManageUsers: true, isOwner: false }).at(-1)).toEqual(["Access & settings", ["Users"]]);
  });

  it("drops the last group for a moderator", () => {
    expect(labels({ canManageUsers: false, isOwner: false }).map(([label]) => label)).toEqual([null, "Battle", "Website"]);
  });

  it("shows Discord & transfers to administrators only", () => {
    const website = (access: { canManageUsers: boolean; isOwner: boolean }) => labels(access).find(([label]) => label === "Website")?.[1];
    expect(website({ canManageUsers: true, isOwner: false })).toEqual(["Announcements", "Events", "Rules", "Guides", "Alliance pages", "Gift codes", "Discord & transfers"]);
    expect(website({ canManageUsers: false, isOwner: false })).not.toContain("Discord & transfers");
  });

  it("gives every page its own tour marker", () => {
    const tours = adminNavGroups({ canManageUsers: true, isOwner: true }).flatMap((group) => group.items.map((item) => item.tour));
    expect(new Set(tours).size).toBe(tours.length);
  });
});

describe("activeAdminPath", () => {
  const groups = adminNavGroups({ canManageUsers: true, isOwner: true });

  it("finds the page an address belongs to", () => {
    expect(activeAdminPath("/en/admin", groups)).toBe("");
    expect(activeAdminPath("/de/admin/", groups)).toBe("");
    expect(activeAdminPath("/en/admin/kvk/3f2a/leaders", groups)).toBe("/kvk");
    expect(activeAdminPath("/en/admin/rules/topics/3f2a", groups)).toBe("/rules");
    expect(activeAdminPath("/en/admin/guides/3f2a/alliances/new", groups)).toBe("/guides");
    expect(activeAdminPath("/en/admin/settings/usage", groups)).toBe("/settings");
    expect(activeAdminPath("/en/admin/events/new", groups)).toBe("/events");
    expect(activeAdminPath("/en/admin/alliances/3f2a", groups)).toBe("/alliances");
  });

  it("matches whole path segments only, and nothing outside the admin area", () => {
    expect(activeAdminPath("/en/admin/rulesx", groups)).toBeNull();
    expect(activeAdminPath("/en/admin/login", groups)).toBeNull();
    expect(activeAdminPath("/en/rules", groups)).toBeNull();
    expect(activeAdminPath("/en/admin/users", adminNavGroups({ canManageUsers: false, isOwner: false }))).toBeNull();
  });
});
