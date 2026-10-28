import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { LanguageList } from "@/components/admin/OwnerSettingsForms";
import { SettingsTabPage } from "@/components/admin/SettingsFrame";
import { AdminSection, EmptyRow } from "@/components/admin/ui";
import { getLanguageSettings } from "@/lib/admin/settings-data";

export const metadata: Metadata = { title: "Settings · Languages" };

export default async function LanguageSettingsPage() {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <SettingsTabPage locale={locale} tab="languages" load={getLanguageSettings}>
        {(languages) => (
          <AdminSection
            id="languages"
            title="Languages"
            tour="settings-languages"
            hint="The order of the language menu, and which languages players can pick. A hidden language leaves the menu, its links open the same page in the player's other language and nothing is translated into it, so it costs nothing; showing it again brings it back as it was. Arrange the list, then Save."
          >
            {languages.available ? (
              <LanguageList languages={languages.languages} texts={languages.texts} locale={locale} />
            ) : (
              <EmptyRow>The languages could not be read from the database.</EmptyRow>
            )}
            <p className="mt-3 text-xs text-ink-faint">
              Texts not translated yet show in English. A new language is added in the code, not here, so it comes with its game words, writing rules and a
              reviewed translation (SETUP.md, “Adding a language”). After a save the menu changes at once; players who already have the site open see it after a
              reload.
            </p>
          </AdminSection>
        )}
      </SettingsTabPage>
    </Suspense>
  );
}
