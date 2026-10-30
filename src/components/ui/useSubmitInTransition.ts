"use client";

import { useTransition } from "react";

/**
 * The form's onSubmit for an action: it sends the form inside a transition, so
 * React doesn't reset the fields afterwards. React's own reset goes back to
 * the values the page was drawn with, and Chromium (Android and desktop
 * Chrome, Edge) doesn't move a dropdown to its new default, so an edit form
 * showed the value from before the save next to "Saved" (a new role reverted
 * to the old one until a reload). It also keeps what was typed when a save is
 * refused. The Save button still shows "Saving…" (useFormStatus follows it).
 * Forms that add rows leave it off: they should clear after an add. Rally
 * Sync's join form uses it too, so a wrong password doesn't wipe the room ID.
 */
export function useSubmitInTransition(action: (formData: FormData) => void) {
  const [, startSubmit] = useTransition();
  return (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
}
