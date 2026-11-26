import type { FieldErrors } from "./forms";

/** What the admin forms get back from their Server Actions (via useActionState). */
export interface ActionState {
  status: "idle" | "saved" | "error";
  message?: string;
  errors?: FieldErrors;
  /**
   * The save needs a second, knowing tap (the message says what it will do): the form posts this value back as
   * `confirm` with the same choice. A different choice asks again.
   */
  confirm?: string;
}

export const IDLE_STATE: ActionState = { status: "idle" };
