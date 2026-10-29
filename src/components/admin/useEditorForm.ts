"use client";

import { useActionState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";

/**
 * A content editor form's action, submitted inside a transition so React
 * doesn't reset the fields to stale defaults after a save (see PlanForm).
 */
export function useEditorForm(save: (previous: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, action] = useActionState<ActionState, FormData>(save, IDLE_STATE);
  const [, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
  return { state, action, submit, errors: state.errors ?? {} };
}
