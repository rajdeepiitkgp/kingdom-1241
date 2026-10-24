import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { LoginCard } from "@/components/admin/LoginCard";
import { PageHeader } from "@/components/ui/SectionTitle";
import { adminPath, safeNextPath } from "@/lib/auth/paths";
import { canEditContent } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Admin sign-in" };

/** Sign-in page of the admin area (outside the gate). The council's tool, so English only. */
export default async function AdminLoginPage({ searchParams }: PageProps<"/[locale]/admin/login">) {
  const locale = await rootLocale();
  return (
    <div className="mx-auto max-w-md" dir="ltr">
      <PageHeader icon="🔐" title="Admin area" subtitle="For the kingdom council: edit the battle plan and, later, the rest of the site." />
      <Suspense fallback={<div className="card h-48 animate-pulse bg-card-soft" aria-hidden />}>
        <LoginGate locale={locale} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginGate({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: PageProps<"/[locale]/admin/login">["searchParams"];
}) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, adminPath(locale));
  if (user && canEditContent(user.role)) redirect(next);
  const error = typeof params.error === "string" ? params.error : null;
  return <LoginCard locale={locale} next={next} error={error} user={user} />;
}
