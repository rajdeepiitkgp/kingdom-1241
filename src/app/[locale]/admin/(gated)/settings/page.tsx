import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { CapacityForm } from "@/components/admin/CapacityForm";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getOwnerSettings, type OwnerEntry } from "@/lib/admin/settings-data";
import { requireEditor } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Settings locale={locale} />
    </Suspense>
  );
}

async function Settings({ locale }: { locale: string }) {
  const user = await requireEditor(locale);
  if (!user) return null;
  if (!user.isOwner) return <EmptyRow>Only the owner can open the settings.</EmptyRow>;
  const settings = await getOwnerSettings();
  if (!settings) return <EmptyRow>The settings could not be loaded. Reload the page.</EmptyRow>;

  return (
    <div className="space-y-6">
      <SectionTitle icon="⚙️" title="Settings" />
      <p className="text-sm font-semibold text-ink-muted">
        Only you, the owner, see this page and its link. Changes apply at once, and each one appears under Recent changes on the Overview.
      </p>

      <AdminSection title="Owner" tour="settings-owner" hint="Set once, when the site is set up (SITE_OWNER in Vercel, SETUP.md § 8.2). Nothing in the site can change it.">
        <OwnerLine owners={settings.owners} />
      </AdminSection>

      <AdminSection
        title="Rally Sync capacity"
        tour="settings-capacity"
        hint="How many rooms of each kind moderators can open at once, and how many leaders and browsers each room takes. The three kinds share one limit, so the total is checked with every change."
      >
        <CapacityForm initial={settings.rally.capacity} usage={settings.rally.usage} available={settings.rally.available} locale={locale} />
      </AdminSection>
    </div>
  );
}

const OWNER_KINDS: Record<OwnerEntry["kind"], string> = { discord_id: "Discord user id", discord_handle: "Discord username", email: "E-mail (development only)" };

function OwnerLine({ owners }: { owners: OwnerEntry[] }) {
  if (owners.length === 0) return <p className="text-sm font-bold text-danger">SITE_OWNER is not set.</p>;
  return (
    <ul className="space-y-2">
      {owners.map((owner) => (
        <li key={`${owner.kind}:${owner.value}`} className="text-sm">
          <span className="font-bold text-ink">{OWNER_KINDS[owner.kind]}:</span>{" "}
          <span className="font-semibold break-all text-ink-muted tabular" dir="ltr">
            {owner.value}
          </span>
          {owner.kind === "discord_handle" && (
            <p className="mt-1 text-xs text-ink-faint">
              A username can be renamed and then taken by someone else. Switch SITE_OWNER to your Discord user id (Discord → Settings → Advanced → Developer Mode,
              then Copy User ID on your profile) in Vercel, and redeploy.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
