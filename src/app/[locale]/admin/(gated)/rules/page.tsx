import type { Metadata } from "next";
import Link from "next/link";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { AdminContentSkeleton } from "@/components/admin/AdminShell";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { EmptyRow } from "@/components/admin/ui";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { listRuleTopics } from "@/lib/admin/content-data";
import { deleteRule, deleteRuleTopic } from "@/lib/admin/rules-actions";
import { adminPath } from "@/lib/auth/paths";
import { requireEditor } from "@/lib/auth/server";
import { pick } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Rules" };

/** What the create and delete actions report through the address (they redirect instead of returning a state). */
const NOTICES: Record<string, [string, boolean]> = {
  "created:topic": ["Topic created. Add its rules with “Add a rule”.", true],
  "deleted:topic": ["Topic deleted, with its rules.", true],
  "deleted:rule": ["Rule deleted.", true],
  "error:forbidden": ["You don't have permission for that.", false],
  "error:delete": ["Deleting failed. Try again in a moment.", false],
};

/** Guide markers of the first topic and its first rule only (one marker per page). */
const FIRST = { topicTour: "rules-topic", topicActionsTour: "rules-topic-actions", ruleTour: "rules-rule", addTour: "rules-add" };

type ListProps = PageProps<"/[locale]/admin/rules">;

export default async function AdminRulesPage({ searchParams }: ListProps) {
  const locale = await rootLocale();
  return (
    <Suspense fallback={<AdminContentSkeleton />}>
      <Rules locale={locale} searchParams={searchParams} />
    </Suspense>
  );
}

async function Rules({ locale, searchParams }: { locale: string; searchParams: ListProps["searchParams"] }) {
  if (!(await requireEditor(locale))) return null;
  const [query, topics] = await Promise.all([searchParams, listRuleTopics()]);
  const key = (["created", "deleted", "error"] as const).map((name) => (typeof query[name] === "string" ? `${name}:${query[name]}` : null)).find(Boolean);
  const [notice, good] = key ? (NOTICES[key] ?? ["That didn't work. Try again.", false]) : [null, false];
  return (
    <div className="space-y-5">
      <SectionTitle
        icon="📜"
        title="Rules"
        action={
          <Link href={adminPath(locale, "/rules/topics/new")} className="btn-primary btn-sm" data-tour="rules-new-topic">
            New topic
          </Link>
        }
      />
      <p className="text-sm font-semibold text-ink-muted">
        The kingdom&apos;s rules, in every language. Each topic is a tab on the rules page and holds its rules in order. You write in English; the other languages
        follow within a minute of saving.
      </p>
      {notice && (
        <p role="status" className={`rounded-xl px-3 py-2 text-sm font-bold ${good ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {notice}
        </p>
      )}
      {topics === null ? (
        <EmptyRow>The rules could not be read from the database.</EmptyRow>
      ) : topics.length === 0 ? (
        <EmptyRow>No topics yet. The rules page stays empty until you add one.</EmptyRow>
      ) : (
        topics.map((topic, index) => (
          <section key={topic.id} className="card space-y-3 p-4" data-tour={index === 0 ? FIRST.topicTour : undefined}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <MoveButtons locale={locale} table="rule_topics" id={topic.id} position={index} count={topics.length} label="topic" />
              <span className="text-3xl" aria-hidden>
                {topic.icon}
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <h2 className="text-lg font-extrabold wrap-break-word text-ink" dir="ltr">
                  {pick(topic.title, "en") || "Untitled topic"}
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-ink-muted">
                  {!topic.published && <span className="chip bg-gold-soft text-gold-ink">Hidden</span>}
                  {topic.pending.length > 0 && <span className="chip bg-card-soft text-ink-muted">⏳ Translating</span>}
                  <span dir="ltr">#{topic.slug}</span>
                  <span>
                    · {topic.rules.length} {topic.rules.length === 1 ? "rule" : "rules"}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-tour={index === 0 ? FIRST.topicActionsTour : undefined}>
                <Link href={adminPath(locale, `/rules/topics/${topic.id}`)} className="btn-ghost btn-sm">
                  Edit topic
                </Link>
                <DeleteForm
                  action={deleteRuleTopic}
                  hidden={{ locale, id: topic.id }}
                  confirmText={`Delete the topic “${pick(topic.title, "en")}” and its ${topic.rules.length} rules in every language? This can't be undone.`}
                />
              </div>
            </div>

            {topic.rules.length > 0 && (
              <ol className="space-y-2">
                {topic.rules.map((rule, ruleIndex) => (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-card-soft p-3"
                    data-tour={index === 0 && ruleIndex === 0 ? FIRST.ruleTour : undefined}
                  >
                    <MoveButtons locale={locale} table="rules" id={rule.id} position={ruleIndex} count={topic.rules.length} label="rule" />
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-extrabold wrap-break-word text-ink" dir="ltr">
                        {pick(rule.title, "en") || "Untitled rule"}
                      </p>
                      {(!rule.published || rule.pending.length > 0) && (
                        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold">
                          {!rule.published && <span className="chip bg-gold-soft text-gold-ink">Draft</span>}
                          {rule.pending.length > 0 && <span className="chip bg-card text-ink-muted">⏳ Translating</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
                      <Link href={adminPath(locale, `/rules/${rule.id}`)} className="btn-ghost btn-sm">
                        Edit
                      </Link>
                      <DeleteForm action={deleteRule} hidden={{ locale, id: rule.id }} confirmText={`Delete the rule “${pick(rule.title, "en")}” in every language? This can't be undone.`} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href={adminPath(locale, `/rules/new?topic=${topic.id}`)}
              className="btn-ghost btn-sm"
              data-tour={index === 0 ? FIRST.addTour : undefined}
            >
              + Add a rule
            </Link>
          </section>
        ))
      )}
    </div>
  );
}
