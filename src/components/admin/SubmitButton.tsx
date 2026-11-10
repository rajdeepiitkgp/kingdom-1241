"use client";

import { useFormStatus } from "react-dom";

/** `disabled` is for a form that knows nothing has changed yet. */
export function SubmitButton({ children, className = "btn-primary btn-sm", disabled = false }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
