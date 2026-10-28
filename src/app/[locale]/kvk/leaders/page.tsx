import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { KvkGateSkeleton } from "@/components/kvk/KvkGate";
import { LeaderGate } from "@/components/kvk/LeaderGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_TOURS } from "@/lib/kvk/tours";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["leaders.title"] };
}

/**
 * Password-locked rally-leader plan, with its own password (not the battle
 * plan's). The header is part of the static shell; the gate streams in.
 */
export default async function LeadersPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon="👑" title={dict["leaders.title"]} subtitle={dict["leaders.subtitle"]} guide={<PageGuide tour={KVK_TOURS.leaders} dict={dict} />} />
      <Suspense fallback={<KvkGateSkeleton />}>
        <LeaderGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
