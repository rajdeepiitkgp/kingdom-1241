"use client";

import { useActionState } from "react";
import { useSubmitInTransition } from "@/components/ui/useSubmitInTransition";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";

/** A content editor form's action and its onSubmit (`useSubmitInTransition`). */
export function useEditorForm(save: (previous: ActionState, formData: FormData) => Promise<ActionState>) {
  const [state, action] = useActionState<ActionState, FormData>(save, IDLE_STATE);
  const submit = useSubmitInTransition(action);
  return { state, action, submit, errors: state.errors ?? {} };
}
