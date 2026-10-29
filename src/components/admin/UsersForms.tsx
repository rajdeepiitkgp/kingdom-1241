"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { addGrant, setRole } from "@/lib/admin/users-actions";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/roles";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useSubmitInTransition } from "./useEditorForm";

export function RoleForm({
  locale,
  id,
  role,
  canGrantAdmin,
  locked,
}: {
  locale: string;
  id: string;
  role: Role;
  /** Only the owner may hand out the administrator role. */
  canGrantAdmin: boolean;
  /** Why this row can't be changed by the viewer (null = editable). */
  locked: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(setRole, IDLE_STATE);
  // Without it, Chrome showed the old role next to "Role updated." until a reload.
  const submit = useSubmitInTransition(action);
  const options = ROLES.filter((r) => r !== "admin" || canGrantAdmin || r === role);
  return (
    <form action={action} onSubmit={submit} className="flex flex-wrap items-center gap-2" data-tour="users-role">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={id} />
      <select name="role" className="input w-auto select-chevron py-2" defaultValue={role} disabled={Boolean(locked)} aria-label="Role" title={locked ?? undefined}>
        {options.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      {locked ? <span className="text-xs font-semibold text-ink-faint">{locked}</span> : <SubmitButton className="btn-ghost btn-sm">Save</SubmitButton>}
      <Notice state={state} />
    </form>
  );
}

export function GrantForm({ locale, canGrantAdmin }: { locale: string; canGrantAdmin: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(addGrant, IDLE_STATE);
  return (
    <form action={action} className="grid grid-cols-1 gap-2 md:grid-cols-[9rem_1fr_1fr_1fr_auto] md:items-end">
      <input type="hidden" name="locale" value={locale} />
      <Field label="Role" htmlFor="grant-role">
        <select id="grant-role" name="role" className="input select-chevron" defaultValue="moderator">
          <option value="moderator">Moderator</option>
          {canGrantAdmin && <option value="admin">Administrator</option>}
        </select>
      </Field>
      <Field label="Discord username" htmlFor="grant-discord" error={state.errors?.discordUsername}>
        <input id="grant-discord" name="discordUsername" className="input" dir="ltr" autoComplete="off" placeholder="handle, not display name" />
      </Field>
      <Field label="or e-mail" htmlFor="grant-email">
        <input id="grant-email" name="email" type="email" className="input" dir="ltr" autoComplete="off" placeholder="name@example.com" />
      </Field>
      <Field label="Note" htmlFor="grant-note">
        <input id="grant-note" name="note" className="input" maxLength={200} placeholder="optional" />
      </Field>
      <div className="pb-1">
        <SubmitButton>Pre-authorise</SubmitButton>
      </div>
      <Notice state={state} className="md:col-span-full" />
    </form>
  );
}
