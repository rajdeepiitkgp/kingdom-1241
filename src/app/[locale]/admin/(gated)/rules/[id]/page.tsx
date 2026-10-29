import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { ContentTranslationMode } from "@/components/admin/ContentTranslationMode";
import { LanguagePicker } from "@/components/admin/LanguagePicker";
import { RuleTextForm } from "@/components/admin/RulesForms";
import { EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getRuleForEditing, listRuleTopics } from "@/lib/admin/content-data";
import { BODY_MAX, bodySourceFor, TITLE_MAX } from "@/lib/admin/content-forms";
import { isUuid } from "@/lib/admin/forms";
import { parseEditLang } from "@/lib/admin/translation";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { getLanguages } from "@/lib/data";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Edit rule" };

/** "new" is the only id known in advance; real ids are rendered on request (Cache Components wants at least one). */
export function generateStaticParams() {
  return [{ id: "new" }];
}

type EditorProps = PageProps<"/[locale]/admin/rules/[id]">;

/** What a just-created rule's editor says (the create action redirects here). */
const CREATED: Record<string, string> = {
  live: "Created. Players see it on the rules page within seconds; the other languages follow within a minute.",
  draft: "Created as a draft: players don't see it until you tick “Show on the rules page” and save.",
};

export default async function AdminRuleEditorPage({ params, searchParams }: EditorProps) {
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
  const topics = (await listRuleTopics()) ?? [];

  if (id === "new") {
    const wanted = typeof query.topic === "string" && isUuid(query.topic) ? query.topic : null;
    const topicId = topics.some((topic) => topic.id === wanted) ? wanted : null;
    return (
      <div className="space-y-5">
        <SectionTitle icon="📜" title="New rule" action={back} />
        {topics.length === 0 ? (
          <EmptyRow>Create a topic first: every rule belongs to one.</EmptyRow>
        ) : (
          <RuleTextForm rule={null} topicId={topicId} topics={topics} bodySource="" locale={locale} />
        )}
      </div>
    );
  }

  if (!isUuid(id)) notFound();
  const [rule, languages] = await Promise.all([getRuleForEditing(id), getLanguages()]);
  if (!rule) notFound();
  const enabled = languages.filter((l) => l.enabled);
  const lang = parseEditLang(typeof query.lang === "string" ? query.lang : "en", enabled.map((l) => l.code));
  const created = typeof query.created === "string" ? CREATED[query.created] : undefined;
  const topic = topics.find((t) => t.id === rule.topicId);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={topic?.icon ?? "📜"}
        title={pick(rule.title, "en") || "Rule"}
        action={
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {back}
            <Link href={`/${locale}/rules${topic ? `#${topic.slug}` : ""}`} className="btn-ghost btn-sm" target="_blank" rel="noopener" data-tour="rule-view">
              View the rules page ↗
            </Link>
          </div>
        }
      />
      <div data-tour="rule-language">
        <LanguagePicker languages={enabled} current={lang} href={adminPath(locale, `/rules/${rule.id}`)} />
      </div>
      {created && lang === "en" && (
        <p role="status" className="rounded-xl bg-success-soft px-3 py-2 text-sm font-bold text-success">
          {created}
        </p>
      )}
      {lang === "en" ? (
        <RuleTextForm rule={rule} topicId={rule.topicId} topics={topics} bodySource={bodySourceFor(rule, "en")} locale={locale} />
      ) : (
        <ContentTranslationMode
          key={lang}
          table="rules"
          id={rule.id}
          locale={locale}
          lang={lang}
          langLabel={enabled.find((l) => l.code === lang)!.nativeName}
          title="Rule"
          fields={[
            { column: "title", label: "Rule", english: pick(rule.title, "en"), value: rule.title[lang] ?? "", pending: rule.pending.includes("title"), maxLength: TITLE_MAX },
            {
              column: "body",
              label: "Explanation",
              english: bodySourceFor(rule, "en"),
              value: rule.body[lang] ? bodySourceFor(rule, lang) : "",
              pending: rule.pending.includes("body"),
              markdown: true,
              maxLength: BODY_MAX,
            },
          ]}
        />
      )}
    </div>
  );
}
