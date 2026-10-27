import { Suspense } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { ActiveNavLink, NavLinkView } from "./NavLink";
import { ActiveNavMenu, NavMenuView } from "./NavMenu";

/**
 * Navigation. The links themselves are rendered on the server; only the
 * "is this the current page" highlight needs the client pathname, so that
 * part lives in a tiny leaf component behind a Suspense boundary (required
 * for routes with dynamic params under Cache Components). The fallback is the
 * same link without the highlight, so nothing shifts.
 */

/**
 * Desktop navigation (top bar), from `lg`; below that the bottom tab bar serves
 * tablets too. The nav takes the free space between logo and controls and is a
 * container: NavLinkView shows the labels only when that space is wide enough
 * for the longest language (Polish, Turkish, French), icon-only pills otherwise,
 * so the row never overflows, whatever the language or text size.
 */
export function DesktopNav({ locale, dict }: { locale: string; dict: Dictionary }) {
  return (
    <nav className="@container hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavEntry key={item.href} item={item} locale={locale} dict={dict} variant="desktop" />
      ))}
    </nav>
  );
}

/** One nav entry: a link, or a dropdown when the section has several pages (KvK). */
function NavEntry({ item, locale, dict, variant }: { item: NavItem; locale: string; dict: Dictionary; variant: "desktop" | "mobile" }) {
  const common = { section: item.href, icon: item.icon, label: dict[item.labelKey], variant };
  if (item.children) {
    const entries = item.children.map((child) => ({
      href: localePath(locale, child.href),
      section: child.href,
      label: dict[child.labelKey],
      hint: dict[child.hintKey],
    }));
    return (
      <Suspense fallback={<NavMenuView {...common} entries={entries} active={false} />}>
        <ActiveNavMenu {...common} entries={entries} />
      </Suspense>
    );
  }
  const props = { ...common, href: localePath(locale, item.href) };
  return (
    <Suspense fallback={<NavLinkView {...props} active={false} />}>
      <ActiveNavLink {...props} />
    </Suspense>
  );
}

/** Mobile bottom tab bar. */
export function BottomNav({ locale, dict }: { locale: string; dict: Dictionary }) {
  return (
    <nav
      id="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_hsl(var(--shadow-color)/0.25)] backdrop-blur-sm lg:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <NavEntry item={item} locale={locale} dict={dict} variant="mobile" />
          </li>
        ))}
      </ul>
    </nav>
  );
}
