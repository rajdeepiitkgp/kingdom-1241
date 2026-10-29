import { PendingRefresher } from "@/components/admin/PendingRefresher";
import { TranslationForm } from "@/components/admin/TranslationForm";
import { AdminSection } from "@/components/admin/ui";
import { saveContentTranslation } from "@/lib/admin/content-actions";
import { pendingNote } from "@/lib/admin/translation";
import { getTranslationSettings } from "@/lib/config/settings";

export interface TranslatedField {
  column: string;
  label: string;
  english: string;
  value: string;
  pending: boolean;
  maxLength: number;
  /** A Markdown text: the editor with its preview. */
  markdown?: boolean;
  multiline?: boolean;
}

/**
 * The content editor in another language than English: each text next to its
 * English source, corrected for that language only (`saveContentTranslation`).
 * Render it keyed by language: the forms are uncontrolled, so a switch must
 * remount them with that language's text.
 */
export async function ContentTranslationMode({
  table,
  id,
  locale,
  lang,
  langLabel,
  title,
  fields,
}: {
  table: string;
  id: string;
  locale: string;
  lang: string;
  langLabel: string;
  title: string;
  fields: TranslatedField[];
}) {
  const { paused } = await getTranslationSettings();
  const pending = fields.some((field) => field.pending);
  return (
    <>
      <PendingRefresher active={pending && !paused} />
      <p className="rounded-xl bg-card-soft px-3 py-2 text-sm font-bold text-ink-muted">
        Corrections saved here apply to {langLabel} only and are never overwritten until the English text changes again.
        {pending && pendingNote(paused)}
      </p>
      <AdminSection title={title}>
        <div className="space-y-3">
          {fields.map((field) => (
            <TranslationForm
              key={field.column}
              action={saveContentTranslation}
              locale={locale}
              lang={lang}
              langLabel={langLabel}
              table={table}
              id={id}
              column={field.column}
              label={field.label}
              english={field.english}
              value={field.value}
              pending={field.pending}
              multiline={field.multiline ?? field.markdown}
              markdown={field.markdown}
              maxLength={field.maxLength}
            />
          ))}
        </div>
      </AdminSection>
    </>
  );
}
