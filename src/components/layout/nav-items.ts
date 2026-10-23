import type { UiKey } from "@/content/seed/ui-strings";

export interface NavItem {
  /** Path without locale prefix. */
  href: string;
  labelKey: UiKey;
  icon: "home" | "events" | "rules" | "guides" | "kvk" | "tools";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: "home" },
  { href: "/events", labelKey: "nav.events", icon: "events" },
  { href: "/rules", labelKey: "nav.rules", icon: "rules" },
  { href: "/guides", labelKey: "nav.guides", icon: "guides" },
  { href: "/kvk", labelKey: "nav.kvk", icon: "kvk" },
  { href: "/tools", labelKey: "nav.tools", icon: "tools" },
];

/** Is `pathname` (without locale) inside the nav item's section? */
export function isActivePath(pathWithoutLocale: string, href: string): boolean {
  if (href === "/") return pathWithoutLocale === "/" || pathWithoutLocale === "";
  return pathWithoutLocale === href || pathWithoutLocale.startsWith(`${href}/`);
}
