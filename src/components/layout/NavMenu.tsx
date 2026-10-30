"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { stripLocale } from "@/lib/i18n/paths";
import { activeChildHref, isActivePath } from "./nav-items";
import { NavIcon } from "./NavIcon";
import type { NavLinkProps } from "./NavLink";

export interface NavMenuEntry {
  /** Full href including the locale prefix. */
  href: string;
  /** Path without locale, used for the active check. */
  section: string;
  label: string;
  hint: string;
}

type NavMenuProps = Omit<NavLinkProps, "href"> & { entries: NavMenuEntry[] };

/** Reads the pathname (client-only URL data) and renders the dropdown with its active state. */
export function ActiveNavMenu(props: NavMenuProps) {
  const path = stripLocale(usePathname());
  const current = activeChildHref(
    path,
    props.entries.map((e) => e.section),
  );
  return <NavMenuView {...props} active={isActivePath(path, props.section)} current={current} />;
}

/**
 * A nav entry that opens a small list of pages (the KvK pages, each with its
 * own password). A disclosure, not an ARIA menu: the button toggles a list of
 * ordinary links. Closes on a link click, Escape, a click outside or when
 * focus leaves it. Also the server-rendered Suspense fallback (closed, no
 * highlight).
 */
export function NavMenuView({
  icon,
  label,
  variant,
  entries,
  active,
  current = null,
}: NavMenuProps & { active: boolean; current?: string | null }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const desktop = variant === "desktop";
  const panel = open && (
    <div
      id={panelId}
      className={clsx(
        "z-50 rounded-3xl border border-line bg-card p-1.5 shadow-lift",
        // Desktop: under the pill. Phone and tablet: above the bottom bar, centred on it (the bar is the containing block).
        desktop ? "absolute inset-s-0 top-full mt-2 w-72" : "absolute inset-x-3 bottom-full mx-auto mb-2 max-w-sm",
      )}
    >
      <ul className="grid grid-cols-1 gap-1">
        {entries.map((entry) => {
          const here = entry.section === current;
          return (
            <li key={entry.href}>
              <Link
                href={entry.href}
                aria-current={here ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-start transition-colors",
                  here ? "bg-primary-soft" : "hover:bg-card-soft",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className={clsx("block text-sm font-extrabold wrap-break-word", here ? "text-primary" : "text-ink")}>{entry.label}</span>
                  <span className="block text-xs font-semibold wrap-break-word text-ink-muted">{entry.hint}</span>
                </span>
                {here && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  const toggle = {
    ref: button,
    type: "button" as const,
    "aria-expanded": open,
    "aria-current": active ? ("true" as const) : undefined,
    "aria-controls": open ? panelId : undefined,
    onClick: () => setOpen((value) => !value),
  };

  return (
    <div
      ref={root}
      // Desktop: the panel hangs under this wrapper. Mobile: no position, so the panel sits on the bottom bar.
      className={clsx(desktop && "relative")}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {desktop ? (
        <button
          {...toggle}
          title={label}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-extrabold break-keep transition-colors",
            active ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-primary-soft hover:text-ink",
          )}
        >
          <NavIcon icon={icon} className="size-4" />
          <span className="sr-only @min-[40.5rem]:not-sr-only">{label}</span>
          <ChevronDown className={clsx("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      ) : (
        <button
          {...toggle}
          className={clsx(
            "flex w-full min-w-0 flex-col items-center gap-1 px-0.5 pt-2.5 pb-2 text-[0.6875rem] leading-none font-extrabold transition-colors",
            active || open ? "text-primary" : "text-ink-faint hover:text-ink-muted",
          )}
        >
          <span className={clsx("flex h-8 w-full max-w-14 items-center justify-center rounded-full transition-colors", (active || open) && "bg-primary-soft")}>
            <NavIcon icon={icon} className="size-5" />
          </span>
          <span className="flex max-w-full items-center justify-center gap-0.5">
            <span className="line-clamp-2 min-w-0 text-center leading-tight wrap-break-word hyphens-auto">{label}</span>
            <ChevronDown className={clsx("size-3 shrink-0 transition-transform", !open && "rotate-180")} aria-hidden />
          </span>
        </button>
      )}
      {panel}
    </div>
  );
}
