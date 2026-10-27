import clsx from "clsx";
import Link from "next/link";
import { adminPath } from "@/lib/auth/paths";

/** The pages of one battle in the admin area; each public page has its own password. */
export function PlanEditorTabs({ locale, planId, current }: { locale: string; planId: string; current: "plan" | "leaders" }) {
  const tabs = [
    { key: "plan", href: adminPath(locale, `/kvk/${planId}`), label: "⚔️ Battle plan (all players)" },
    { key: "leaders", href: adminPath(locale, `/kvk/${planId}/leaders`), label: "👑 Rally leaders" },
  ] as const;
  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl bg-card-soft p-1.5" aria-label="Pages of this battle">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
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
