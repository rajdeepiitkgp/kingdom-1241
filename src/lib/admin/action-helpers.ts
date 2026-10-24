import { headers } from "next/headers";
import type { AccessDenial } from "@/lib/auth/server";
import { createLogger, requestId, type Logger } from "@/lib/log";
import type { ActionState } from "./action-state";
import type { FieldErrors } from "./forms";

/**
 * The replies every admin Server Action gives, in one place, so the wording
 * (and the logging) stays the same across the editors. Field parsing lives in
 * forms.ts; these only shape the `ActionState` the forms render.
 */

export const INVALID_FIELDS = "Please fix the highlighted fields.";
export const SAVE_FAILED = "Saving failed. Try again in a moment.";
export const SESSION_ENDED = "Your session has ended. Sign in again.";
export const NO_PERMISSION = "You don't have permission for this.";

/** The access check failed: a signed-out session gets a different hint from a missing role. */
export function denied(reason: AccessDenial, forbidden = NO_PERMISSION): ActionState {
  return { status: "error", message: reason === "signed_out" ? SESSION_ENDED : forbidden };
}

/** Validation failed: the form highlights `errors` and shows the standard message (or a specific one). */
export function invalid(errors: FieldErrors, message = INVALID_FIELDS): ActionState {
  return { status: "error", errors, message };
}

/** A write failed: log what and why (never the row), tell the admin to retry. */
export function failed(log: Logger, what: string, error: { message: string; code?: string }, message = SAVE_FAILED): ActionState {
  log.error(`${what} failed`, { error: error.message, code: error.code });
  return { status: "error", message };
}

/** The admin logger for this request, carrying the request id like the route handlers do. */
export async function actionLogger(scope = "admin"): Promise<Logger> {
  return createLogger(scope).child({ reqId: requestId(await headers()) });
}
