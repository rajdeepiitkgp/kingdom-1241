"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-primary btn-sm" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
