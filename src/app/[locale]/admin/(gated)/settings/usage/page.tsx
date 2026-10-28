import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { SettingsTabPage } from "@/components/admin/SettingsFrame";
import { UsageReport } from "@/components/admin/UsageReport";
import { getUsageSettings } from "@/lib/admin/settings-data";

export const metadata: Metadata = { title: "Settings · Usage" };

export default async function UsageSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <SettingsTabPage locale={locale} tab="usage" load={getUsageSettings}>
        {(usage) => <UsageReport data={usage} locale={locale} />}
      </SettingsTabPage>
    </Suspense>
  );
}
