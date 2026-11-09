import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { RetroGate, RetroGateSkeleton } from "@/components/retro/RetroGate";
import { PageGuide } from "@/components/tour/PageGuide";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { KVK_FEEDBACK_TOUR } from "@/lib/kvk/tours/feedback";

/** The interface strings this page and its components use; tests/architecture/page-strings.test.ts keeps the list right. */
const PAGE_STRINGS = ["checklist", "common", "kvk", "leaders", "retro", "tour.*", "tour.feedback", "tour.kvk"];

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale(), PAGE_STRINGS);
  return { title: dict["retro.title"] };
}

/**
 * Battle feedback (retrospective), behind the same password as the battle
 * plan. The header is part of the static shell; the gate (cookie check, open
 * form, alliances) streams in behind Suspense.
 */
export default async function FeedbackPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale, PAGE_STRINGS);

  return (
    <div>
      <PageHeader icon="📝" title={dict["retro.title"]} subtitle={dict["retro.subtitle"]} guide={<PageGuide tour={KVK_FEEDBACK_TOUR} dict={dict} />} />
      <Suspense fallback={<RetroGateSkeleton />}>
        <RetroGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
