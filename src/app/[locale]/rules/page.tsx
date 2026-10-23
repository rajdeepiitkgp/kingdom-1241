import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { RulesTabs } from "@/components/rules/RulesTabs";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getRuleTopics } from "@/lib/data";
import { getDictionary } from "@/lib/i18n/get-dictionary";

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
      <RulesTabs topics={topics.filter((t) => t.published)} dict={dict} locale={locale} />
    </div>
  );
}
