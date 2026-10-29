"use client";

import type { AdminGuide, AdminGuideSection } from "@/lib/admin/content-data";
import { BODY_MAX, MARKDOWN_HINT, SUMMARY_MAX, TITLE_MAX } from "@/lib/admin/content-forms";
import { saveGuide, saveGuideSection } from "@/lib/admin/guides-actions";
import { pick } from "@/lib/i18n/localized";
import { MarkdownEditor } from "./MarkdownEditor";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useEditorForm } from "./useEditorForm";

/** A guide in English: title, summary, icon, address and the shared text (Markdown with up to ten images). */
export function GuideForm({ guide, bodySource, locale }: { guide: AdminGuide | null; bodySource: string; locale: string }) {
  const { state, action, submit, errors } = useEditorForm(saveGuide);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      {guide && <input type="hidden" name="id" value={guide.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_8rem]">
        <Field label="Title (English)" htmlFor="title" error={errors.title} tour="guide-title" hint="Usually the event's name, such as “Bear Hunt”.">
          <input id="title" name="title" className="input" defaultValue={pick(guide?.title, "en")} maxLength={TITLE_MAX} dir="ltr" />
        </Field>
        <Field label="Icon" htmlFor="icon" error={errors.icon} tour="guide-icon" hint="One emoji.">
          <input id="icon" name="icon" className="input text-center text-xl" defaultValue={guide?.icon ?? "📖"} maxLength={16} />
        </Field>
      </div>

      <Field label="Summary (English)" htmlFor="summary" error={errors.summary} tour="guide-summary" hint="One or two sentences on the guide's card in the list of guides.">
        <textarea id="summary" name="summary" className="input min-h-20" defaultValue={pick(guide?.summary, "en")} maxLength={SUMMARY_MAX} dir="ltr" />
      </Field>

      <Field
        label="Address"
        htmlFor="slug"
        error={errors.slug}
        tour="guide-slug"
        hint={`The guide's page is /guides/${guide?.slug || "the-address"}. Leave it empty to make one from the title; changing it breaks links people already shared (events follow by themselves).`}
      >
        <input id="slug" name="slug" className="input font-mono" defaultValue={guide?.slug ?? ""} maxLength={60} dir="ltr" placeholder="made from the title" />
      </Field>

      <Field label="Text for everyone (English)" htmlFor="bodySource" error={errors.bodySource} tour="guide-body" hint={MARKDOWN_HINT}>
        <MarkdownEditor id="bodySource" name="bodySource" defaultValue={bodySource} images="guide" maxLength={BODY_MAX} />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink" data-tour="guide-published">
        <input key={`published-${String(guide?.published ?? true)}`} type="checkbox" name="published" defaultChecked={guide?.published ?? true} className="size-4" />
        Show on the guides page (untick to keep it as a draft)
      </label>

      <div className="flex flex-wrap items-center gap-3" data-tour="guide-save">
        <SubmitButton>{guide ? "Save guide" : "Create guide"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

/** One alliance's section of a guide in English: the alliance (chosen once) and its text. */
export function GuideSectionForm({
  guideId,
  section,
  alliances,
  bodySource,
  locale,
}: {
  guideId: string;
  section: AdminGuideSection | null;
  /** The alliances a new section may be for (on the list, without a section in this guide yet). */
  alliances: Array<{ tag: string; name: string }>;
  bodySource: string;
  locale: string;
}) {
  const { state, action, submit, errors } = useEditorForm(saveGuideSection);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="guideId" value={guideId} />
      {section && <input type="hidden" name="id" value={section.id} />}

      {!section && (
        <Field
          label="Alliance"
          htmlFor="allianceTag"
          error={errors.allianceTag}
          tour="guide-section-alliance"
          hint="The alliance list is the one on Home (the owner keeps it). Alliances that already have a section in this guide aren't offered."
        >
          <select id="allianceTag" name="allianceTag" className="input select-chevron" defaultValue="">
            <option value="">Pick an alliance</option>
            {alliances.map((alliance) => (
              <option key={alliance.tag} value={alliance.tag}>
                [{alliance.tag}] {alliance.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="How this alliance plays it (English)" htmlFor="bodySource" error={errors.bodySource} tour="guide-section-body" hint={MARKDOWN_HINT}>
        <MarkdownEditor id="bodySource" name="bodySource" defaultValue={bodySource} images="guide" maxLength={BODY_MAX} />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink" data-tour="guide-section-published">
        <input key={`published-${String(section?.published ?? true)}`} type="checkbox" name="published" defaultChecked={section?.published ?? true} className="size-4" />
        Show on the guide (untick to keep it as a draft)
      </label>

      <div className="flex flex-wrap items-center gap-3" data-tour="guide-section-save">
        <SubmitButton>{section ? "Save section" : "Create section"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
