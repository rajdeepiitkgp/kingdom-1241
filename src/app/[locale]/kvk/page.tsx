import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { KvkGate, KvkGateSkeleton } from "@/components/kvk/KvkGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_PLAN_TOUR } from "@/lib/kvk/tours/plan";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["checklist", "common", "kvk", "leaders", "tools", "tour.*", "tour.kvk"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["kvk.title"] };
}

/**
 * Password-locked KvK battle plan. The header is part of the static shell;
 * the gate (cookie check + plan) streams in behind Suspense.
 */
export default async function KvkPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div>
      <PageHeader icon="⚔️" title={dict["kvk.title"]} subtitle={dict["kvk.subtitle"]} guide={<PageGuide tour={KVK_PLAN_TOUR} dict={dict} />} />
      <Suspense fallback={<KvkGateSkeleton />}>
        <KvkGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
