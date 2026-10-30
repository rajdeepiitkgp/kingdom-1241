import type { ReactNode } from "react";

/** A quiet fold-out section of the coordinator's panel; `onToggle` hears it open and close. */
export function Disclosure({ title, children, onToggle }: { title: string; children: ReactNode; onToggle?: (open: boolean) => void }) {
  return (
    <details className="card-soft group px-4 py-3" onToggle={onToggle && ((event) => onToggle(event.currentTarget.open))}>
      <summary className="cursor-pointer text-sm font-extrabold text-ink">
        <span className="me-1 inline-block transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90" aria-hidden>
          ›
        </span>
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
