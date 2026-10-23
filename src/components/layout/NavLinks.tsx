"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath, stripLocale } from "@/lib/i18n/paths";
import { isActivePath, NAV_ITEMS } from "./nav-items";
import { NavIcon } from "./NavIcon";

/** Desktop navigation (top bar). */
export function DesktopNav({ locale, dict }: { locale: string; dict: Dictionary }) {
  const pathname = usePathname();
  const current = stripLocale(pathname);

  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(current, item.href);
        return (
          <Link
            key={item.href}
            href={localePath(locale, item.href)}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-colors",
              active ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-primary-soft hover:text-ink",
            )}
          >
            <NavIcon icon={item.icon} className="size-4" />
            {dict[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile bottom tab bar. */
export function BottomNav({ locale, dict }: { locale: string; dict: Dictionary }) {
  const pathname = usePathname();
  const current = stripLocale(pathname);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-12px_hsl(var(--shadow-color)/0.25)] backdrop-blur md:hidden"
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(current, item.href);
          return (
            <li key={item.href}>
              <Link
                href={localePath(locale, item.href)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] font-extrabold leading-none transition-colors",
                  active ? "text-primary" : "text-ink-faint hover:text-ink-muted",
                )}
              >
                <span
                  className={clsx(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <NavIcon icon={item.icon} className="size-5" />
                </span>
                <span className="truncate">{dict[item.labelKey]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
