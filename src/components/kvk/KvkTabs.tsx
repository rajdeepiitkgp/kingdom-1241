import clsx from "clsx";
import { MessageSquareHeart, Swords } from "lucide-react";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { localePath } from "@/lib/i18n/paths";

/** Switch between the battle plan and its feedback form; shown on both pages while a form is open. */
export function KvkTabs({ locale, dict, current }: { locale: string; dict: Dictionary; current: "plan" | "feedback" }) {
  const tabs = [
    { key: "plan", href: localePath(locale, "/kvk"), label: dict["kvk.tab.plan"], Icon: Swords },
    { key: "feedback", href: localePath(locale, "/kvk/feedback"), label: dict["kvk.tab.feedback"], Icon: MessageSquareHeart },
  ] as const;
  return (
    <nav className="flex gap-2 rounded-2xl bg-card-soft p-1.5" aria-label={dict["kvk.title"]} data-tour="kvk-tabs">
      {tabs.map(({ key, href, label, Icon }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold transition-colors",
              active ? "bg-primary text-primary-ink shadow-[0_3px_0_0_var(--primary-strong)]" : "text-ink-muted hover:bg-card hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
