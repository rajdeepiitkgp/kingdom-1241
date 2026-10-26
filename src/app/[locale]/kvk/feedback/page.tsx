import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { Suspense } from "react";
import { RetroGate, RetroGateSkeleton } from "@/components/retro/RetroGate";
import { PageHeader } from "@/components/ui/SectionTitle";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await rootLocale());
  return { title: dict["retro.title"] };
}

/**
 * Battle feedback (retrospective), behind the same password as the battle
 * plan. The header is part of the static shell; the gate (cookie check, open
 * form, alliances) streams in behind Suspense.
 */
export default async function FeedbackPage() {
  const locale = await rootLocale();
  const dict = await getDictionary(locale);

  return (
    <div>
      <PageHeader icon="📝" title={dict["retro.title"]} subtitle={dict["retro.subtitle"]} />
      <Suspense fallback={<RetroGateSkeleton />}>
        <RetroGate dict={dict} locale={locale} />
      </Suspense>
    </div>
  );
}
