import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense, type ReactNode } from "react";
import { AdminShell, AdminSkeleton } from "@/components/admin/AdminShell";
import { NoAccess } from "@/components/admin/LoginCard";
import { adminPath, loginPath } from "@/lib/auth/paths";
import { canEditContent } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/server";

/**
 * Gate for everything under /admin except the login page: reads the session
 * (request time, hence the Suspense boundary), sends visitors to the login
 * page and members without a role to a "no access" note, and wraps the rest
 * in the admin chrome.
 */
export default async function GatedAdminLayout({ children }: { children: ReactNode }) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminGate locale={locale}>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ locale, children }: { locale: string; children: ReactNode }) {
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);
  const current = requestHeaders.get("x-pathname") ?? adminPath(locale);
  if (!user) redirect(loginPath(locale, current));
  if (!canEditContent(user.role)) {
    return (
      <div className="card mx-auto max-w-md p-6" dir="ltr">
        <NoAccess locale={locale} user={user} path={current} />
      </div>
    );
  }
  return (
    <AdminShell user={user} locale={locale}>
      {children}
    </AdminShell>
  );
}
