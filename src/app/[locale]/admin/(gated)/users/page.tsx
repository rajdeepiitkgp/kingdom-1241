import type { Metadata } from "next";
import { formatGameName } from "@/lib/admin/profile";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { GrantForm, RoleForm } from "@/components/admin/UsersForms";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { utcLabel } from "@/lib/admin/format";
import { deleteGrant, removeAccount } from "@/lib/admin/users-actions";
import { listGrants, listProfiles } from "@/lib/admin/users-data";
import { canManageUsers, grantsFor, ROLE_LABELS } from "@/lib/auth/roles";
import { requireEditor } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Users" };

/** What a redirecting action reports through `?error=`. */
const NOTICES: Record<string, string> = {
  remove: "That account can't be removed: not the owner, not yourself, and only the owner removes administrators. Or the removal failed; try again in a moment.",
  grant: "That pre-authorisation couldn't be removed: only the owner withdraws an administrator's, or the removal failed. Try again in a moment.",
};

export default async function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Users locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ locale, searchParams }: { locale: string; searchParams: PageProps<"/[locale]/admin/users">["searchParams"] }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  if (!canManageUsers(user.role)) {
    return <EmptyRow>Only administrators can manage users.</EmptyRow>;
  }
  const [params, profiles, grants] = await Promise.all([searchParams, listProfiles(), listGrants()]);
  const notice = typeof params.error === "string" ? (NOTICES[params.error] ?? "That didn't work. Try again.") : null;

  return (
    <div className="space-y-6">
      <SectionTitle icon="👥" title="Users" />
      {notice && (
        <p role="status" className="rounded-xl bg-card-soft px-3 py-2 text-sm font-bold text-ink">
          {notice}
        </p>
      )}

      <AdminSection
        title="Accounts"
        tour="users-accounts"
        hint="Everyone who has signed in at least once, under the in-game name they set themselves. Roles belong to the Discord account, so check the handle next to the name before promoting someone. The owner (SITE_OWNER) is always an administrator and alone appoints administrators; administrators appoint moderators and can delete plans; moderators edit content and the battle plan; members have no admin access."
      >
        {profiles.length === 0 ? (
          <EmptyRow>Nobody has signed in yet.</EmptyRow>
        ) : (
          <ul className="divide-y divide-line">
            {profiles.map((profile) => {
              const locked = profile.isOwner
                ? "Owner: always an administrator"
                : profile.id === user.id
                  ? "You can't change your own role"
                  : profile.role === "admin" && !user.isOwner
                    ? "Only the owner can change administrators"
                    : null;
              return (
                <li key={profile.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                      {formatGameName(profile.gameName, profile.allianceTag) ?? <span className="text-ink-faint">no in-game name yet</span>}
                      {profile.isOwner && <span className="chip bg-gold-soft text-gold-ink">Owner</span>}
                      {!profile.isOwner &&
                        grantsFor(grants, profile).map((grant) => (
                          <span key={grant.id} className="chip bg-primary-soft text-primary" title="A pre-authorisation re-applies this role at every sign-in; remove it below to make a demotion stick.">
                            pre-authorised: {ROLE_LABELS[grant.role]}
                          </span>
                        ))}
                      {profile.id === user.id && <span className="text-xs font-bold text-ink-faint">(you)</span>}
                    </p>
                    <p className="text-sm text-ink-muted" dir="ltr">
                      {profile.discordUsername ? `@${profile.discordUsername}` : (profile.email ?? "—")}
                      {profile.displayName && profile.displayName !== profile.gameName ? ` · ${profile.displayName}` : ""} · last sign-in{" "}
                      {utcLabel(profile.lastSignInAt)}
                    </p>
                  </div>
                  <RoleForm locale={locale} id={profile.id} role={profile.role} canGrantAdmin={user.isOwner} locked={locked} />
                  {!locked && (
                    <DeleteForm
                      action={removeAccount}
                      hidden={{ locale, id: profile.id }}
                      confirmText={`Remove the account of ${formatGameName(profile.gameName, profile.allianceTag) ?? profile.displayName}? They can sign in again later, but with no access.`}
                      label="Remove"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </AdminSection>

      <AdminSection
        title="Pre-authorisations"
        tour="users-grants"
        hint="Give someone a role before their first sign-in. Matched by Discord username (the handle, not the display name) or e-mail. A person who already signed in gets the role right away."
      >
        <GrantForm locale={locale} canGrantAdmin={user.isOwner} />
        {grants.length > 0 && (
          <ul className="mt-4 divide-y divide-line">
            {grants.map((grant) => (
              <li key={grant.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="chip bg-primary-soft text-ink">{ROLE_LABELS[grant.role]}</span>
                <span className="font-bold text-ink" dir="ltr">
                  {grant.discordUsername ? `@${grant.discordUsername}` : grant.email}
                </span>
                <span className="min-w-0 flex-1 text-ink-muted">{grant.note}</span>
                {grant.role !== "admin" || user.isOwner ? (
                  <DeleteForm
                    action={deleteGrant}
                    hidden={{ locale, id: grant.id }}
                    confirmText="Remove this pre-authorisation? Accounts that already have the role keep it."
                    label="Remove"
                  />
                ) : (
                  <span className="text-xs font-semibold text-ink-muted">Owner only</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </div>
  );
}
