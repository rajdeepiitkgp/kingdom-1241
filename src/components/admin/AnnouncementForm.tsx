"use client";

import { useActionState, useTransition } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/admin/action-state";
import { saveAnnouncement } from "@/lib/admin/content-actions";
import type { AdminAnnouncement } from "@/lib/admin/content-data";
import { BODY_MAX, MARKDOWN_HINT, TITLE_MAX } from "@/lib/admin/content-forms";
import { toUtcInputValue } from "@/lib/admin/forms";
import { pick } from "@/lib/i18n/localized";
import { DateTimeField } from "./DateTimeField";
import { MarkdownEditor } from "./MarkdownEditor";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";

/** An announcement in English: title, text (Markdown with images), shown or draft, pinned, expiry. */
export function AnnouncementForm({ announcement, bodySource, locale }: { announcement: AdminAnnouncement | null; bodySource: string; locale: string }) {
  const [state, action] = useActionState<ActionState, FormData>(saveAnnouncement, IDLE_STATE);
  // Submitted inside a transition so React doesn't reset the fields to stale defaults after a save (see PlanForm).
  const [, startSubmit] = useTransition();
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startSubmit(() => action(data));
  };
  const errors = state.errors ?? {};
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      {announcement && <input type="hidden" name="id" value={announcement.id} />}

      <Field label="Title (English)" htmlFor="title" error={errors.title} tour="announcement-title">
        <input id="title" name="title" className="input" defaultValue={pick(announcement?.title, "en")} maxLength={TITLE_MAX} dir="ltr" />
      </Field>

      <Field
        label="Text (English)"
        htmlFor="bodySource"
        error={errors.bodySource}
        tour="announcement-body"
        hint={MARKDOWN_HINT}
      >
        <MarkdownEditor id="bodySource" name="bodySource" defaultValue={bodySource} images="announcement" maxLength={BODY_MAX} />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DateTimeField
          id="expiresAt"
          name="expiresAt"
          label="Leaves Home at (UTC, optional)"
          defaultValue={toUtcInputValue(announcement?.expiresAt)}
          hint="For news with an end, such as an event this weekend. Leave it empty to keep it until you change or delete it."
          error={errors.expiresAt}
          allowPast={announcement !== null}
          tour="announcement-expiry"
        />
      </div>

      <div className="flex flex-col gap-2 text-sm font-bold text-ink">
        <label className="flex items-center gap-2" data-tour="announcement-published">
          <input key={`published-${String(announcement?.published ?? true)}`} type="checkbox" name="published" defaultChecked={announcement?.published ?? true} className="size-4" />
          Show on Home (untick to keep it as a draft)
        </label>
        <label className="flex items-center gap-2" data-tour="announcement-pinned">
          <input key={`pinned-${String(announcement?.pinned ?? false)}`} type="checkbox" name="pinned" defaultChecked={announcement?.pinned ?? false} className="size-4" />
          Pin to the top
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3" data-tour="announcement-save">
        <SubmitButton>{announcement ? "Save announcement" : "Create announcement"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
