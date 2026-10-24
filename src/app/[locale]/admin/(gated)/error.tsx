"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { adminPath } from "@/lib/auth/paths";

/**
 * Error boundary of the admin area (English only, like the rest of it). The
 * digest matches the one Next prints in the server log, so the owner can find
 * the failure from a screenshot.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? "en";

  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <p className="text-5xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-3 text-xl font-black text-ink">The admin area hit an error</h1>
      <p className="mt-2 text-sm font-semibold text-ink-muted">
        Try again. If it keeps happening, tell the site owner and include the reference code.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs font-bold text-ink-faint">
          Reference: <code className="rounded-md bg-card-soft px-1.5 py-0.5 text-ink" dir="ltr">{error.digest}</code>
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          <RotateCcw className="size-4" aria-hidden />
          Try again
        </button>
        <Link href={adminPath(locale)} className="btn-ghost">
          Back to the overview
        </Link>
      </div>
    </div>
  );
}
