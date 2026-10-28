import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { CapacityForm } from "@/components/admin/CapacityForm";
import { SettingsTabPage } from "@/components/admin/SettingsFrame";
import { AdminSection } from "@/components/admin/ui";
import { getRallyCapacitySettings } from "@/lib/admin/settings-data";

export const metadata: Metadata = { title: "Settings · Rally Sync" };

export default async function RallySyncSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <SettingsTabPage locale={locale} tab="rally-sync" load={getRallyCapacitySettings}>
        {(rally) => (
          <AdminSection
            id="rally-sync"
            title="Rally Sync capacity"
            tour="settings-capacity"
            hint="How many rooms of each kind moderators can open at once, and how many leaders and browsers each room takes. The three kinds share one limit, so the total is checked with every change."
          >
            <CapacityForm initial={rally.capacity} usage={rally.usage} available={rally.available} locale={locale} />
          </AdminSection>
        )}
      </SettingsTabPage>
    </Suspense>
  );
}
