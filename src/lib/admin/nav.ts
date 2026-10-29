/**
 * The admin area's menu (pure, unit-tested): its pages in groups, and which
 * one the current address belongs to. Paths are below `/{locale}/admin`.
 */

export type AdminNavIcon =
  | "overview"
  | "plans"
  | "feedback"
  | "rallySync"
  | "announcements"
  | "events"
  | "rules"
  | "guides"
  | "alliances"
  | "transfers"
  | "giftCodes"
  | "users"
  | "settings";

export interface AdminNavItem {
  /** Below /{locale}/admin: "" is the overview. */
  path: string;
  label: string;
  icon: AdminNavIcon;
  /** Its guided-tour marker. */
  tour: string;
}

export interface AdminNavGroup {
  /** Null for the overview, which stands above the groups. */
  label: string | null;
  items: AdminNavItem[];
}

/** The pages this person may open, grouped; a group with nothing left is dropped. */
export function adminNavGroups(access: { canManageUsers: boolean; isOwner: boolean }): AdminNavGroup[] {
  const groups: AdminNavGroup[] = [
    { label: null, items: [{ path: "", label: "Overview", icon: "overview", tour: "admin-nav-overview" }] },
    {
      label: "Battle",
      items: [
        { path: "/kvk", label: "Battle plans", icon: "plans", tour: "admin-nav-plans" },
        { path: "/feedback", label: "Feedback", icon: "feedback", tour: "admin-nav-feedback" },
        { path: "/rally-sync", label: "Rally Sync", icon: "rallySync", tour: "admin-nav-rally" },
      ],
    },
    {
      label: "Website",
      items: [
        { path: "/announcements", label: "Announcements", icon: "announcements", tour: "admin-nav-announcements" },
        { path: "/events", label: "Events", icon: "events", tour: "admin-nav-events" },
        { path: "/rules", label: "Rules", icon: "rules", tour: "admin-nav-rules" },
        { path: "/guides", label: "Guides", icon: "guides", tour: "admin-nav-guides" },
        { path: "/alliances", label: "Alliance pages", icon: "alliances", tour: "admin-nav-alliances" },
        { path: "/gift-codes", label: "Gift codes", icon: "giftCodes", tour: "admin-nav-gift-codes" },
        ...(access.canManageUsers ? [{ path: "/transfers", label: "Discord & transfers", icon: "transfers" as const, tour: "admin-nav-transfers" }] : []),
      ],
    },
    {
      label: "Access & settings",
      items: [
        ...(access.canManageUsers ? [{ path: "/users", label: "Users", icon: "users" as const, tour: "admin-nav-users" }] : []),
        ...(access.isOwner ? [{ path: "/settings", label: "Settings", icon: "settings" as const, tour: "admin-nav-settings" }] : []),
      ],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/**
 * The menu entry a path belongs to (`/en/admin/rules/topics/x` → "/rules"),
 * or null outside the menu's pages. The overview matches only itself; the
 * others match their own address and everything below it.
 */
export function activeAdminPath(pathname: string, groups: readonly AdminNavGroup[]): string | null {
  const match = /^\/[^/]+\/admin(\/.*)?$/.exec(pathname.replace(/\/+$/, ""));
  if (!match) return null;
  const rest = match[1] ?? "";
  for (const item of groups.flatMap((group) => group.items)) {
    if (item.path === "" ? rest === "" : rest === item.path || rest.startsWith(`${item.path}/`)) return item.path;
  }
  return null;
}
