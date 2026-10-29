import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { RuleTopicForm } from "@/components/admin/RulesForms";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getRuleTopicForEditing } from "@/lib/admin/content-data";
import { TITLE_MAX } from "@/lib/admin/content-forms";
import { isUuid } from "@/lib/admin/forms";
import { parseEditLang } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit rule topic" };

/** "new" is the only id known in advance; real ids are rendered on request (Cache Components wants at least one). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/rules/topics/[id]">;

export default async function AdminRuleTopicEditorPage({ params, searchParams }: EditorProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Editor locale={locale} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ locale, params, searchParams }: { locale: string; params: EditorProps["params"]; searchParams: EditorProps["searchParams"] }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!(await requireEditor(locale))) return null;
  const back = (
    <Link href={adminPath(locale, "/rules")} className="btn-ghost btn-sm">
      ← Back to rules
    </Link>
  );

  if (id === "new") {
    return (
      <div className="space-y-5">
        <SectionTitle icon="📜" title="New topic" action={back} />
        <RuleTopicForm topic={null} locale={locale} />
      </div>
    );
  }

  if (!isUuid(id)) notFound();
  const [topic, languages] = await Promise.all([getRuleTopicForEditing(id), getLanguages()]);
  if (!topic) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={topic.icon}
        title={pick(topic.title, "en") || "Topic"}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {back}
            <Link href={`/${locale}/rules#${topic.slug}`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="rule-topic-view">
              View the tab ↗
            </Link>
          </div>
        }
      />
      <div data-tour="rule-topic-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/rules/topics/${topic.id}`)} />
      </div>
      {lang === "en" ? (
        <RuleTopicForm topic={topic} locale={locale} />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="rule_topics"
          id={topic.id}
          locale={locale}
          lang={lang}
          langLabel={enabled.find((l) => l.code === lang)!.nativeName}
          title="Topic"
          fields={[
            { column: "title", label: "Name", english: pick(topic.title, "en"), value: topic.title[lang] ?? "", pending: topic.pending.includes("title"), maxLength: TITLE_MAX },
          ]}
        />
      )}
    </div>
  );
}
