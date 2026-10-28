import clsx from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { EmptyRow } from "./ui";

/** The owner's settings: one tab per part, each its own page that loads only what it shows. */

export type SettingsTab = "general" | "usage" | "rally-sync" | "alliances" | "languages";

const TABS: ReadonlyArray<{ key: SettingsTab; path: string; label: string }> = [
  { key: "general", path: "/settings", label: "⚙️ General" },
  { key: "usage", path: "/settings/usage", label: "📊 Usage" },
  { key: "rally-sync", path: "/settings/rally-sync", label: "⏱️ Rally Sync" },
  { key: "alliances", path: "/settings/alliances", label: "🛡️ Alliances" },
  { key: "languages", path: "/settings/languages", label: "🌐 Languages" },
];

function SettingsTabs({ locale, current }: { locale: string; current: SettingsTab }) {
  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl bg-card-soft p-1.5" aria-label="Settings" data-tour="settings-tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={adminPath(locale, tab.path)}
          aria-current={tab.key === current ? "page" : undefined}
          className={clsx(
            "rounded-xl px-3 py-2 text-sm font-extrabold transition-colors",
            tab.key === current ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-card hover:text-ink",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * One tab of the settings page: the owner check (every tab, like every admin
 * page, before any data), the shared heading and tabs, then the tab's own
 * content from its own loader.
 */
export async function SettingsTabPage<T>({
  locale,
  tab,
  load,
  children,
}: {
  locale: string;
  tab: SettingsTab;
  load: () => Promise<T | null>;
  children: (data: T) => ReactNode;
}) {
  const user = await requireEditor(locale);
  if (!user) return null;
  if (!user.isOwner) return <EmptyRow>Only the owner can open the settings.</EmptyRow>;
  const data = await load();
  return (
    <div className="space-y-6">
      <SectionTitle icon="⚙️" title="Settings" />
      <p className="text-sm font-semibold text-ink-muted">
        Only you, the owner, see these pages and their link. Changes apply at once, and each one appears under Recent changes on the Overview.
      </p>
      <SettingsTabs locale={locale} current={tab} />
      {data === null ? <EmptyRow>The settings could not be loaded. Reload the page.</EmptyRow> : children(data)}
    </div>
  );
}
