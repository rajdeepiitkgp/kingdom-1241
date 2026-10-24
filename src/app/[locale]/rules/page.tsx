import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { prepareRichText } from "@/components/content/RichText";
import { RulesTabs, type RulesTabTopic } from "@/components/rules/RulesTabs";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getRuleTopics } from "@/lib/data";
import type { RuleTopic } from "@/lib/data/types";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { pick } from "@/lib/i18n/localized";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["rules.title"] };
}

export default async function RulesPage() {
  const locale = await rootLocale();
  const [dict, topics] = await Promise.all([getDictionary(locale), getRuleTopics()]);

  return (
    <div>
      <PageHeader icon="📜" title={dict["rules.title"]} subtitle={dict["rules.subtitle"]} />
      <RulesTabs topics={topics.filter((t) => t.published).map((t) => toTab(t, locale))} dict={dict} />
    </div>
  );
}

/**
 * The tabs are a Client Component, so the rule bodies are sanitised here and
 * only this language's text is sent to the browser (not every translation).
 */
function toTab(topic: RuleTopic, locale: string): RulesTabTopic {
  return {
    id: topic.id,
    slug: topic.slug,
    icon: topic.icon,
    title: pick(topic.title, locale),
    rules: topic.rules
      .filter((rule) => rule.published)
      .map((rule) => ({ id: rule.id, title: pick(rule.title, locale), html: prepareRichText(pick(rule.body, locale)) })),
  };
}
