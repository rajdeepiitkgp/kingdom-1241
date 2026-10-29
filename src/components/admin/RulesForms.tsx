"use client";

import type { AdminRule, AdminRuleTopic } from "@/lib/admin/content-data";
import { BODY_MAX, MARKDOWN_HINT, TITLE_MAX } from "@/lib/admin/content-forms";
import { saveRule, saveRuleTopic } from "@/lib/admin/rules-actions";
import { pick } from "@/lib/i18n/localized";
import { MarkdownEditor } from "./MarkdownEditor";
import { SubmitButton } from "./SubmitButton";
import { Field, Notice } from "./ui";
import { useEditorForm } from "./useEditorForm";

/** A topic of the rules page in English: its tab's name and icon, its address, shown or hidden. */
export function RuleTopicForm({ topic, locale }: { topic: AdminRuleTopic | null; locale: string }) {
  const { state, action, submit, errors } = useEditorForm(saveRuleTopic);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      {topic && <input type="hidden" name="id" value={topic.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_8rem]">
        <Field label="Name (English)" htmlFor="title" error={errors.title} tour="rule-topic-title" hint="The tab's name on the rules page, such as “Attacks & tiles”.">
          <input id="title" name="title" className="input" defaultValue={pick(topic?.title, "en")} maxLength={TITLE_MAX} dir="ltr" />
        </Field>
        <Field label="Icon" htmlFor="icon" error={errors.icon} tour="rule-topic-icon" hint="One emoji.">
          <input id="icon" name="icon" className="input text-center text-xl" defaultValue={topic?.icon ?? "📜"} maxLength={16} />
        </Field>
      </div>

      <Field
        label="Address"
        htmlFor="slug"
        error={errors.slug}
        tour="rule-topic-slug"
        hint={`A link to this tab ends in #${topic?.slug || "the-address"}. Leave it empty to make one from the name; changing it breaks links people already shared.`}
      >
        <input id="slug" name="slug" className="input font-mono" defaultValue={topic?.slug ?? ""} maxLength={60} dir="ltr" placeholder="made from the name" />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink" data-tour="rule-topic-published">
        <input key={`published-${String(topic?.published ?? true)}`} type="checkbox" name="published" defaultChecked={topic?.published ?? true} className="size-4" />
        Show on the rules page (untick to hide the topic and its rules)
      </label>

      <div className="flex flex-wrap items-center gap-3" data-tour="rule-topic-save">
        <SubmitButton>{topic ? "Save topic" : "Create topic"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

/** One rule in English: its topic, title and text (Markdown with up to three images), shown or hidden. */
export function RuleTextForm({
  rule,
  topicId,
  topics,
  bodySource,
  locale,
}: {
  rule: AdminRule | null;
  /** The topic a new rule goes into. */
  topicId: string | null;
  topics: Array<Pick<AdminRuleTopic, "id" | "title" | "icon">>;
  bodySource: string;
  locale: string;
}) {
  const { state, action, submit, errors } = useEditorForm(saveRule);
  return (
    <form action={action} onSubmit={submit} className="card space-y-5 p-5">
      <input type="hidden" name="locale" value={locale} />
      {rule && <input type="hidden" name="id" value={rule.id} />}

      <Field label="Topic" htmlFor="topicId" error={errors.topicId} tour="rule-topic" hint="The tab the rule is listed under. A rule moved to another topic goes to its end.">
        <select id="topicId" name="topicId" className="input select-chevron" defaultValue={rule?.topicId ?? topicId ?? ""}>
          {!rule && !topicId && <option value="">Pick a topic</option>}
          {topics.map((topic) => (
            <option key={topic.id} value={topic.id}>
              {topic.icon} {pick(topic.title, "en")}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Rule (English)" htmlFor="title" error={errors.title} tour="rule-title" hint="The rule in one line, such as “No attacks inside the kingdom”.">
        <input id="title" name="title" className="input" defaultValue={pick(rule?.title, "en")} maxLength={TITLE_MAX} dir="ltr" />
      </Field>

      <Field label="Explanation (English)" htmlFor="bodySource" error={errors.bodySource} tour="rule-body" hint={MARKDOWN_HINT}>
        <MarkdownEditor id="bodySource" name="bodySource" defaultValue={bodySource} images="rule" maxLength={BODY_MAX} />
      </Field>

      <label className="flex items-center gap-2 text-sm font-bold text-ink" data-tour="rule-published">
        <input key={`published-${String(rule?.published ?? true)}`} type="checkbox" name="published" defaultChecked={rule?.published ?? true} className="size-4" />
        Show on the rules page (untick to keep it as a draft)
      </label>

      <div className="flex flex-wrap items-center gap-3" data-tour="rule-save">
        <SubmitButton>{rule ? "Save rule" : "Create rule"}</SubmitButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
