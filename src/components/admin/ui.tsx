import clsx from "clsx";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { ActionState } from "@/lib/admin/action-state";

/** Small presentational pieces shared by the admin forms (server-safe). */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  tour,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  /** Its guided-tour marker. */
  tour?: string;
  children: ReactNode;
}) {
  // A single control child gets the error announced with it (aria-invalid + aria-describedby).
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const control =
    errorId && Children.count(children) === 1 && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, { "aria-invalid": true, "aria-describedby": errorId })
      : children;
  return (
    <div className={clsx("flex min-w-0 flex-col gap-1", className)} data-tour={tour}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {control}
      {error ? (
        <p id={errorId} className="text-xs font-bold text-danger">
          {error}
        </p>
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

export function AdminSection({ id, title, hint, tour, children }: { id?: string; title: string; hint?: string; tour?: string; children: ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24 p-5" data-tour={tour}>
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      {hint && <p className="mt-1 mb-4 text-sm text-ink-muted">{hint}</p>}
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-card-soft px-4 py-3 text-sm font-semibold text-ink-muted">{children}</p>;
}
