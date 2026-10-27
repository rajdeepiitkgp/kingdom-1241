import type { UiKey } from "@/content/seed/ui-strings";

export interface NavItem {
  /** Path without locale prefix. */
  href: string;
  labelKey: UiKey;
  icon: "home" | "events" | "rules" | "guides" | "kvk" | "tools";
  /** Pages under this section, shown as a dropdown instead of a plain link. */
  children?: NavChild[];
}

export interface NavChild {
  /** Path without locale prefix. */
  href: string;
  labelKey: UiKey;
  /** One short line under the label (who the page is for). */
  hintKey: UiKey;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: "home" },
  { href: "/events", labelKey: "nav.events", icon: "events" },
  { href: "/rules", labelKey: "nav.rules", icon: "rules" },
  { href: "/guides", labelKey: "nav.guides", icon: "guides" },
  {
    href: "/kvk",
    labelKey: "nav.kvk",
    icon: "kvk",
    // Each page has its own password; the battle plan's feedback form lives under /kvk too.
    children: [
      { href: "/kvk", labelKey: "kvk.tab.plan", hintKey: "kvk.menu.planHint" },
      { href: "/kvk/leaders", labelKey: "kvk.menu.leaders", hintKey: "kvk.menu.leadersHint" },
    ],
  },
  { href: "/tools", labelKey: "nav.tools", icon: "tools" },
];

/** Is `pathname` (without locale) inside the nav item's section? */
export function isActivePath(pathWithoutLocale: string, href: string): boolean {
  if (href === "/") return pathWithoutLocale === "/" || pathWithoutLocale === "";
  return pathWithoutLocale === href || pathWithoutLocale.startsWith(`${href}/`);
}

/**
 * Which child of a dropdown is the current page: the most specific href that
 * contains the path (`/kvk/leaders` beats `/kvk`; `/kvk/feedback` stays with
 * `/kvk`), or null outside the section.
 */
export function activeChildHref(pathWithoutLocale: string, hrefs: readonly string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isActivePath(pathWithoutLocale, href) && (best === null || href.length > best.length)) best = href;
  }
  return best;
}
