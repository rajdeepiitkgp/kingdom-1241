"use client";

import { useActionState, useEffect } from "react";
import { signInWithPassword, type DevLoginState } from "@/lib/auth/actions";
import { SubmitButton } from "./SubmitButton";
import { Field } from "./ui";

export function DevLoginForm({ locale, next }: { locale: string; next: string }) {
  const [state, action] = useActionState<DevLoginState, FormData>(signInWithPassword, {});
  useEffect(() => {
    if (state.next) window.location.assign(state.next);
  }, [state.next]);
  return (
    <form action={action} className="mt-6 space-y-3 rounded-2xl border border-dashed border-line p-4">
      <p className="text-xs font-bold text-ink-faint uppercase">Local development only</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail" htmlFor="dev-email">
        <input id="dev-email" name="email" type="email" className="input" autoComplete="username" required />
      </Field>
      <Field label="Password" htmlFor="dev-password">
        <input id="dev-password" name="password" type="password" className="input" autoComplete="current-password" required />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm font-bold text-danger">
          {state.error}
        </p>
      )}
      <SubmitButton className="btn-ghost btn-sm">Sign in with e-mail</SubmitButton>
    </form>
  );
}
