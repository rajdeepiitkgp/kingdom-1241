import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { ChecklistGate } from "@/components/kvk/ChecklistGate";
import { KvkGateSkeleton } from "@/components/kvk/KvkGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_CHECKLIST_TOUR } from "@/lib/kvk/tours/checklist";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["checklist", "common", "kvk", "leaders", "tools", "tour.*", "tour.checklist", "tour.kvk"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["checklist.title"] };
}

/**
 * Password-locked commander checklist, with its own password (neither the
 * battle plan's nor the leaders'). The header is part of the static shell; the
 * gate streams in.
 */
export default async function ChecklistPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div>
      <PageHeader icon="🎖️" title={dict["checklist.title"]} subtitle={dict["checklist.subtitle"]} guide={<PageGuide tour={KVK_CHECKLIST_TOUR} dict={dict} />} />
      <Suspense fallback={<KvkGateSkeleton />}>
        <ChecklistGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
