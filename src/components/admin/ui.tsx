import clsx from "clsx";
import type { ReactNode } from "react";
import type { ActionState } from "@/lib/admin/action-state";

/** Small presentational pieces shared by the admin forms (server-safe). */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-bold text-danger">{error}</p>
      ) : (
        hint && <p className="text-xs text-ink-faint">{hint}</p>
      )}
    </div>
  );
}

export function Notice({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role="status"
      className={clsx(
        "rounded-xl px-3 py-2 text-sm font-bold",
        state.status === "saved" ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        className,
      )}
    >
      {state.message}
    </p>
  );
}

export function AdminSection({ id, title, hint, children }: { id?: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      {hint && <p className="mt-1 mb-4 text-sm text-ink-muted">{hint}</p>}
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-card-soft px-4 py-3 text-sm font-semibold text-ink-muted">{children}</p>;
}
