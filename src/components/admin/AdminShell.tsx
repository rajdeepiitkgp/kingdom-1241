import { type ReactNode, Suspense } from "react";
import { adminNavGroups } from "@/lib/admin/nav";
import { formatGameName } from "@/lib/admin/profile";
import { signOut } from "@/lib/auth/actions";
import { canManageUsers, ROLE_LABELS } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/server";
import { AdminGuide } from "./AdminGuide";
import { AdminNav } from "./AdminNav";

/**
 * The admin area's frame (English only, council tool): a top strip with the
 * page's guide, who is signed in and sign-out, and the grouped menu beside
 * the page (a sidebar from laptop width up, a menu button above it below).
 */
export function AdminShell({ user, locale, children }: { user: CurrentUser; locale: string; children: ReactNode }) {
  const groups = adminNavGroups({ canManageUsers: canManageUsers(user.role), isOwner: user.isOwner });
  return (
    <div dir="ltr">
      <div className="card-soft mb-4 flex flex-wrap items-center gap-3 px-4 py-3 lg:mb-6 print:hidden">
        <span className="text-base font-black text-ink">🛠️ Admin</span>
        <Suspense fallback={null}>
          <AdminGuide />
        </Suspense>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:ms-auto">
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
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6 print:block">
        <AdminNav locale={locale} groups={groups} />
        <div className="min-w-0">{children}</div>
      </div>
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
