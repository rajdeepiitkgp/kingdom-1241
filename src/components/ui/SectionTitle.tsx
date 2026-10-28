import type { ReactNode } from "react";

export function SectionTitle({
  icon,
  title,
  action,
  as: Tag = "h2",
}: {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <Tag className="flex items-center gap-2.5 text-xl font-extrabold text-ink md:text-2xl">
        {icon && <span className="grid size-9 place-items-center rounded-xl bg-gold-soft text-lg" aria-hidden>{icon}</span>}
        {title}
      </Tag>
      {action}
    </div>
  );
}

/** `guide`: the page's guided tour (a PageGuide); its "New here?" line takes a row of its own under the title. */
export function PageHeader({ icon, title, subtitle, guide }: { icon: ReactNode; title: string; subtitle?: string; guide?: ReactNode }) {
  return (
    <header className="mb-6 md:mb-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-gold text-2xl shadow-[0_3px_0_0_var(--gold-strong)]" aria-hidden>
          {icon}
        </span>
        <h1 className="min-w-0 text-2xl font-black text-ink md:text-3xl">{title}</h1>
        {guide}
      </div>
      {subtitle && <p className="mt-2 text-base font-semibold text-ink-muted">{subtitle}</p>}
    </header>
  );
}
