"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { stripLocale } from "@/lib/i18n/paths";
import { isActivePath, type NavItem } from "./nav-items";
import { NavIcon } from "./NavIcon";

export interface NavLinkProps {
  /** Full href including the locale prefix. */
  href: string;
  /** Section path without locale, used for the active check. */
  section: string;
  icon: NavItem["icon"];
  label: string;
  variant: "desktop" | "mobile";
}

/** Reads the pathname (client-only URL data) and renders the link with its active state. */
export function ActiveNavLink(props: NavLinkProps) {
  const pathname = usePathname();
  return <NavLinkView {...props} active={isActivePath(stripLocale(pathname), props.section)} />;
}

/** Pure presentational link — rendered by the server as the Suspense fallback too. */
export function NavLinkView({ href, icon, label, variant, active }: NavLinkProps & { active: boolean }) {
  if (variant === "desktop") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold transition-colors",
          active ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-primary-soft hover:text-ink",
        )}
      >
        <NavIcon icon={icon} className="size-4" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex min-w-0 flex-col items-center gap-1 px-0.5 pt-2.5 pb-2 text-[11px] leading-none font-extrabold transition-colors",
        active ? "text-primary" : "text-ink-faint hover:text-ink-muted",
      )}
    >
      <span className={clsx("flex h-8 w-14 items-center justify-center rounded-full transition-colors", active && "bg-primary-soft")}>
        <NavIcon icon={icon} className="size-5" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </Link>
  );
}
