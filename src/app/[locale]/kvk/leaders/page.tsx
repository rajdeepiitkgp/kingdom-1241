import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { KvkGateSkeleton } from "@/components/kvk/KvkGate";
import { LeaderGate } from "@/components/kvk/LeaderGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_LEADERS_TOUR } from "@/lib/kvk/tours/leaders";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["checklist", "common", "kvk", "leaders", "tools", "tour.*", "tour.kvk", "tour.leaders"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["leaders.title"] };
}

/**
 * Password-locked rally-leader plan, with its own password (not the battle
 * plan's). The header is part of the static shell; the gate streams in.
 */
export default async function LeadersPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div>
      <PageHeader icon="👑" title={dict["leaders.title"]} subtitle={dict["leaders.subtitle"]} guide={<PageGuide tour={KVK_LEADERS_TOUR} dict={dict} />} />
      <Suspense fallback={<KvkGateSkeleton />}>
        <LeaderGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
