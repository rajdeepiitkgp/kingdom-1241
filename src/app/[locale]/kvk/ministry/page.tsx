// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { MinistryGate, MinistryGateSkeleton } from "@/components/ministry/MinistryGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_MINISTRY_TOUR } from "@/lib/kvk/tours/ministry";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["checklist", "common", "kvk", "leaders", "ministry", "prep.council", "prep.day", "prep.item", "retro", "time.ended", "time.live", "time.startsIn", "tour.*", "tour.kvk", "tour.ministry"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["ministry.title"] };
}

/**
 * Ministry appointments: players sign up for the king's buff days of the KvK
 * prep week, behind the same password as the battle plan. The header is part
 * of the static shell; the gate (cookie check, the open round, the form)
 * streams in behind Suspense.
 */
export default async function MinistryPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div>
      <PageHeader icon="👑" title={dict["ministry.title"]} subtitle={dict["ministry.subtitle"]} guide={<PageGuide tour={KVK_MINISTRY_TOUR} dict={dict} />} />
      <Suspense fallback={<MinistryGateSkeleton />}>
        <MinistryGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
