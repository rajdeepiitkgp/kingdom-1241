import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { ChecklistGate } from "@/components/kvk/ChecklistGate";
import { KvkGateSkeleton } from "@/components/kvk/KvkGate";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["checklist.title"] };
}

/**
 * Password-locked commander checklist, with its own password (neither the
 * battle plan's nor the leaders'). The header is part of the static shell; the
 * gate streams in.
 */
export default async function ChecklistPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon="🎖️" title={dict["checklist.title"]} subtitle={dict["checklist.subtitle"]} />
      <Suspense fallback={<KvkGateSkeleton />}>
        <ChecklistGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
