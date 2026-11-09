import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { RallySyncCard } from "@/components/rally-sync/RallySyncCard";
import { PackValueCalculator } from "@/components/tools/PackValueCalculator";
import { RallyRefillCalculator } from "@/components/tools/RallyRefillCalculator";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["sync", "tools"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["tools.title"] };
}

export default async function ToolsPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div>
      <PageHeader icon="🧮" title={dict["tools.title"]} subtitle={dict["tools.subtitle"]} />
      <div className="space-y-6">
        <RallySyncCard dict={dict} locale={locale} />
        <RallyRefillCalculator dict={dict} locale={locale} />
        <PackValueCalculator dict={dict} locale={locale} />
      </div>
    </div>
  );
}
