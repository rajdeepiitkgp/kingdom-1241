"use client";

import { useActionState } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveProfile } from "@/lib/admin/profile-actions";
import type { Alliance } from "@/lib/data/types";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useSubmitInTransition } from "./useEditorForm";

/** In-game name and home alliance: shown as "[TAG] Name" in the user list and on every change the person makes, like the game does. */
export function ProfileForm({
  gameName,
  allianceTag,
  alliances,
  path,
}: {
  gameName: string | null;
  allianceTag: string | null;
  alliances: Pick<Alliance, "tag" | "name">[];
  path: string;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveProfile, IDLE_STATE);
  const submit = useSubmitInTransition(action);
  return (
    <form action={action} onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_15rem_auto] md:items-end">
      <input type="hidden" name="path" value={path} />
      <Field label="Your in-game name" htmlFor="gameName" error={state.errors?.gameName}>
        <input id="gameName" name="gameName" className="input" defaultValue={gameName ?? ""} maxLength={48} required placeholder="exactly as in Kingshot" />
      </Field>
      <Field label="Home alliance" htmlFor="allianceTag">
        <select id="allianceTag" name="allianceTag" className="input select-chevron" defaultValue={allianceTag ?? ""}>
          <option value="">— not listed —</option>
          {alliances.map((a) => (
            <option key={a.tag} value={a.tag}>
              [{a.tag}] {a.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="pb-1">
        <SubmitButton>Save profile</SubmitButton>
      </div>
      <p className="text-xs text-ink-faint md:col-span-full">
        The name without the tag; the site shows you as “[TAG] Name”. Typing “[ULU] Rudy” works too: the tag is split off.
      </p>
      <Notice state={state} className="md:col-span-full" />
    </form>
  );
}
