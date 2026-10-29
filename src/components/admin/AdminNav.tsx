"use client";

import clsx from "clsx";
import {
  ArrowRightLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Gift,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquareText,
  ScrollText,
  Settings,
  Shield,
  Swords,
  Timer,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { adminPath } from "@/lib/auth/paths";
import { activeAdminPath, type AdminNavGroup, type AdminNavIcon } from "@/lib/admin/nav";

const ICONS: Record<AdminNavIcon, typeof Menu> = {
  overview: LayoutDashboard,
  plans: Swords,
  feedback: MessageSquareText,
  rallySync: Timer,
  announcements: Megaphone,
  events: CalendarDays,
  rules: ScrollText,
  guides: BookOpen,
  alliances: Shield,
  transfers: ArrowRightLeft,
  giftCodes: Gift,
  users: Users,
  settings: Settings,
};

/**
 * The admin area's menu: a sidebar of grouped pages from laptop width up, and
 * below it one button naming the current page that opens the same list. The
 * current page is filled in. The address is read in a leaf under Suspense;
 * the server renders the menu without a current page.
 */
export function AdminNav({ locale, groups }: { locale: string; groups: AdminNavGroup[] }) {
  return (
    <Suspense fallback={<AdminNavView locale={locale} groups={groups} pathname={null} />}>
      <ActiveAdminNav locale={locale} groups={groups} />
    </Suspense>
  );
}

function ActiveAdminNav(props: { locale: string; groups: AdminNavGroup[] }) {
  return <AdminNavView {...props} pathname={usePathname()} />;
}

function AdminNavView({ locale, groups, pathname }: { locale: string; groups: AdminNavGroup[]; pathname: string | null }) {
  // Open for one address only: following a link closes the list without an effect.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = pathname !== null && openAt === pathname;
  const active = pathname === null ? null : activeAdminPath(pathname, groups);
  const current = groups.flatMap((group) => group.items).find((item) => item.path === active);
  const CurrentIcon = current ? ICONS[current.icon] : Menu;

  return (
    <div className="mb-6 lg:mb-0 print:hidden">
      <button
        type="button"
        className="card flex w-full items-center gap-3 px-4 py-3 text-start font-extrabold text-ink lg:hidden"
        aria-expanded={open}
        aria-controls="admin-sections"
        onClick={() => setOpenAt(open ? null : pathname)}
        data-tour="admin-nav-menu"
      >
        <CurrentIcon className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.6875rem] font-black tracking-wider text-ink-faint uppercase">Cockpit</span>
          <span className="block wrap-break-word">{current?.label ?? "Choose a page"}</span>
        </span>
        <ChevronDown className={clsx("size-5 shrink-0 text-ink-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      <nav id="admin-sections" aria-label="Cockpit" className={clsx("card mt-2 p-3 lg:sticky lg:top-24 lg:mt-0 lg:block", !open && "hidden")}>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label ?? "top"}>
              {group.label && <p className="px-3 pb-1.5 text-[0.6875rem] font-black tracking-wider text-ink-faint uppercase">{group.label}</p>}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const selected = item.path === active;
                  return (
                    <li key={item.path}>
                      <Link
                        href={adminPath(locale, item.path)}
                        aria-current={selected ? "page" : undefined}
                        data-tour={item.tour}
                        className={clsx(
                          "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-extrabold transition-colors",
                          selected ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-primary-soft hover:text-ink",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 wrap-break-word">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
