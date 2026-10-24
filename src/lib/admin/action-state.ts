import type { FieldErrors } from "./forms";

/** What the admin forms get back from their Server Actions (via useActionState). */
export interface ActionState {
  status: "idle" | "saved" | "error";
  message?: string;
  errors?: FieldErrors;
}

export const IDLE_STATE: ActionState = { status: "idle" };
