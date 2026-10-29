"use client";

import { useActionState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";

/**
 * The form's onSubmit for an action: it sends the form inside a transition, so
 * React doesn't reset the fields afterwards. React's own reset goes back to
 * the values the page was drawn with, and Chromium (Android and desktop
 * Chrome, Edge) doesn't move a dropdown to its new default, so an edit form
 * showed the value from before the save next to "Saved" (a new role reverted
 * to the old one until a reload). It also keeps what was typed when a save is
 * refused. The Save button still shows "Saving…" (useFormStatus follows it).
 * Forms that add rows leave it off: they should clear after an add.
 */
export function useSubmitInTransition(action: (formData: FormData) => void) {
  const [, startSubmit] = useTransition();
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
}

/** A content editor form's action and its onSubmit (`useSubmitInTransition`). */
export function useEditorForm(save: (previous: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, action] = useActionState<ActionState, FormData>(save, IDLE_STATE);
  const submit = useSubmitInTransition(action);
  return { state, action, submit, errors: state.errors ?? {} };
}
