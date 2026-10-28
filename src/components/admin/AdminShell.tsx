import Link from "next/link";
import { formatGameName } from "@/lib/admin/profile";
import { type ReactNode, Suspense } from "react";
import { signOut } from "@/lib/auth/actions";
import { adminPath } from "@/lib/auth/paths";
import { canManageUsers, ROLE_LABELS } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/server";
import { AdminGuide } from "./AdminGuide";

/** Admin top bar: section links, the page's guide, who is signed in, sign-out. English only (council tool). */
export function AdminShell({ user, locale, children }: { user: CurrentUser; locale: string; children: ReactNode }) {
  const links = [
    { href: adminPath(locale), label: "Overview" },
    { href: adminPath(locale, "/kvk"), label: "Battle plans", tour: "admin-nav-plans" },
    { href: adminPath(locale, "/feedback"), label: "Feedback", tour: "admin-nav-feedback" },
    { href: adminPath(locale, "/rally-sync"), label: "Rally Sync", tour: "admin-nav-rally" },
    ...(canManageUsers(user.role) ? [{ href: adminPath(locale, "/users"), label: "Users", tour: "admin-nav-users" }] : []),
  ];
  return (
    <div dir="ltr">
      <div className="card-soft mb-6 flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-base font-black text-ink">🛠️ Admin</span>
        <Suspense fallback={null}>
          <AdminGuide />
        </Suspense>
        <nav className="flex flex-wrap gap-x-2 gap-y-3" aria-label="Admin sections">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="btn-ghost btn-sm" data-tour={link.tour}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-ink">{formatGameName(user.gameName, user.allianceTag) ?? user.displayName}</span>
          {user.gameName && <span className="text-xs text-ink-faint">({user.displayName})</span>}
          <span className="chip bg-card" data-tour="admin-role">
            {user.isOwner ? "Owner" : ROLE_LABELS[user.role]}
          </span>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn-ghost btn-sm">
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="card-soft h-14" />
      <div className="card h-64 bg-card-soft" />
    </div>
  );
}

/** Placeholder for a page's content while its request-time data streams in. */
export function AdminContentSkeleton() {
  return <div className="card h-64 animate-pulse bg-card-soft" aria-hidden />;
}
