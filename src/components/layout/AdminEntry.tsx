"use client";

import { KeyRound, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useSyncExternalStore } from "react";
import { hasSessionCookie, isAdminPath } from "@/lib/auth/session-hint";
import { stripLocale } from "@/lib/i18n/paths";

export interface AdminEntryLabels {
  /** "Admin sign-in" */
  signIn: string;
  /** "Only for the council…" */
  note: string;
  /** "Admin panel" */
  panel: string;
}

/**
 * The council's way into the admin area, in the header (icon) and footer
 * (text line). It follows the session: signed out it is the key ("Admin
 * sign-in"), signed in it becomes the wrench ("Admin panel"), and inside the
 * admin area it disappears, because the admin bar there has the identity and
 * the "Sign out" button; two sign-in/out controls on one screen were confusing.
 *
 * The session state is read from the cookie in the browser (see
 * session-hint.ts): the chrome is static and cached, so the server renders the
 * signed-out variant and the browser corrects it right after hydration.
 */
export function AdminEntry({ href, labels, variant }: { href: string; labels: AdminEntryLabels; variant: "header" | "footer" }) {
  return (
    <Suspense fallback={<AdminEntryView href={href} labels={labels} variant={variant} signedIn={false} />}>
      <AdminEntryState href={href} labels={labels} variant={variant} />
    </Suspense>
  );
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("focus", onChange);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
};

/** Leaf with the client-only data (pathname, cookie); re-renders on every navigation, so a sign-out redirect is picked up. */
function AdminEntryState({ href, labels, variant }: { href: string; labels: AdminEntryLabels; variant: "header" | "footer" }) {
  const pathname = usePathname();
  const signedIn = useSyncExternalStore(subscribe, () => hasSessionCookie(document.cookie), () => false);
  if (isAdminPath(stripLocale(pathname))) return null;
  return <AdminEntryView href={href} labels={labels} variant={variant} signedIn={signedIn} />;
}

function AdminEntryView({ href, labels, variant, signedIn }: { href: string; labels: AdminEntryLabels; variant: "header" | "footer"; signedIn: boolean }) {
  const Icon = signedIn ? Wrench : KeyRound;
  const label = signedIn ? labels.panel : labels.signIn;
  if (variant === "header") {
    return (
      <Link
        href={href}
        className="hidden size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-ink-muted hover:text-ink sm:grid"
        title={signedIn ? label : `${label} · ${labels.note}`}
        aria-label={signedIn ? label : `${label}. ${labels.note}`}
      >
        <Icon className="size-4" aria-hidden />
      </Link>
    );
  }
  return (
    <p className="mt-4 text-xs text-ink-faint">
      <Link href={href} className="inline-flex items-center gap-1.5 font-bold hover:text-ink-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </Link>
      {!signedIn && <span className="mt-1 block">{labels.note}</span>}
    </p>
  );
}
