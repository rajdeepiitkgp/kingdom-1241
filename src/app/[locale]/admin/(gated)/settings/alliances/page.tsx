import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { AllianceSettings } from "@/components/admin/AllianceSettings";
import { SettingsTabPage } from "@/components/admin/SettingsFrame";
import { AdminSection } from "@/components/admin/ui";
import { getAllianceSettings } from "@/lib/admin/settings-data";
import { DAILY_SYNC_UTC } from "@/lib/alliances/sync-plan";

export const metadata: Metadata = { title: "Settings · Alliances" };

export default async function AllianceSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <SettingsTabPage locale={locale} tab="alliances" load={getAllianceSettings}>
        {(alliances) => (
          <AdminSection
            id="alliances"
            title="Alliances"
            tour="settings-alliances"
            hint={`The alliances on Home, strongest first. Each is linked to its alliance in MightPulse, so its tag, name, power, leader and members follow the game every day at ${DAILY_SYNC_UTC} UTC, even after a rename. When MightPulse is down, type the numbers by hand; the next sync replaces them. Description, requirements and Discord link stay as they are.`}
          >
            <AllianceSettings settings={alliances} locale={locale} />
          </AdminSection>
        )}
      </SettingsTabPage>
    </Suspense>
  );
}
