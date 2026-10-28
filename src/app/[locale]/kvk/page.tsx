import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { KvkGate, KvkGateSkeleton } from "@/components/kvk/KvkGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_TOURS } from "@/lib/kvk/tours";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["kvk.title"] };
}

/**
 * Password-locked KvK battle plan. The header is part of the static shell;
 * the gate (cookie check + plan) streams in behind Suspense.
 */
export default async function KvkPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon="⚔️" title={dict["kvk.title"]} subtitle={dict["kvk.subtitle"]} guide={<PageGuide tour={KVK_TOURS.plan} dict={dict} />} />
      <Suspense fallback={<KvkGateSkeleton />}>
        <KvkGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
